import { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import {
  getCart,
  getMerchants,
  getOrders,
  getProducts,
  getUser,
  saveCart,
  saveMerchants,
  saveOrders,
  saveProducts,
  saveUser,
  UserData,
} from './repository';
import { getSupabaseClient, isSupabaseConfigured } from './supabase';
import { AnalyticsEvent, Cart, MealRecommendation, Merchant, Order } from '../types';
import { getAnalyticsEvents, saveAnalyticsEvents } from '../utils/merchantAnalytics';

export type CloudDatabaseStatus = 'disabled' | 'connecting' | 'connected' | 'error';

type Bucket = 'user' | 'cart' | 'merchants' | 'products' | 'orders' | 'analytics';

const BUCKET_EVENTS: Record<Bucket, string> = {
  user: 'user_updated',
  cart: 'cart_updated',
  merchants: 'merchants_updated',
  products: 'products_updated',
  orders: 'orders_updated',
  analytics: 'analytics_updated',
};

const TABLE_BUCKETS: Record<string, Bucket> = {
  profiles: 'user',
  carts: 'cart',
  merchants: 'merchants',
  products: 'products',
  orders: 'orders',
  analytics_events: 'analytics',
};

let status: CloudDatabaseStatus = isSupabaseConfigured ? 'connecting' : 'disabled';
let initialization: Promise<CloudDatabaseStatus> | null = null;
let realtimeChannel: RealtimeChannel | null = null;
let ownerId = '';
let applyingRemote = false;
let listenersRegistered = false;
let syncQueue: Promise<void> = Promise.resolve();
const recentLocalPush = new Map<Bucket, number>();

const setStatus = (nextStatus: CloudDatabaseStatus): void => {
  status = nextStatus;
  document.documentElement.dataset.cloudDatabase = nextStatus;
  window.dispatchEvent(new CustomEvent('cloud_database_status', { detail: nextStatus }));
};

export const getCloudDatabaseStatus = (): CloudDatabaseStatus => status;

const assertResult = (result: { error: { message: string } | null }): void => {
  if (result.error) throw new Error(result.error.message);
};

const getOwner = async (client: SupabaseClient): Promise<string> => {
  const sessionResult = await client.auth.getSession();
  if (sessionResult.error) throw sessionResult.error;
  if (sessionResult.data.session?.user.id) return sessionResult.data.session.user.id;

  const signInResult = await client.auth.signInAnonymously();
  if (signInResult.error) throw signInResult.error;
  const userId = signInResult.data.user?.id;
  if (!userId) throw new Error('無法建立匿名資料庫工作階段');
  return userId;
};

const rowPayload = <T,>(row: unknown): T | undefined => {
  if (!row || typeof row !== 'object') return undefined;
  const payload = (row as { payload?: unknown }).payload;
  return payload && typeof payload === 'object' ? payload as T : undefined;
};

const selectSinglePayload = async <T,>(client: SupabaseClient, table: string): Promise<T | undefined> => {
  const result = await client.from(table).select('payload').eq('owner_id', ownerId).maybeSingle();
  assertResult(result);
  return rowPayload<T>(result.data);
};

const selectPayloads = async <T,>(
  client: SupabaseClient,
  table: string,
  orderColumn?: string,
): Promise<T[]> => {
  let query = client.from(table).select('payload').eq('owner_id', ownerId);
  if (orderColumn) query = query.order(orderColumn, { ascending: false });
  const result = await query;
  assertResult(result);
  return (result.data || []).map((row) => rowPayload<T>(row)).filter((item): item is T => Boolean(item));
};

const replaceOwnedRows = async (
  client: SupabaseClient,
  table: string,
  idColumn: string,
  rows: Record<string, unknown>[],
): Promise<void> => {
  if (rows.length > 0) {
    const upsertResult = await client.from(table).upsert(rows, { onConflict: 'owner_id,' + idColumn });
    assertResult(upsertResult);
  }

  const existingResult = await client.from(table).select(idColumn).eq('owner_id', ownerId);
  assertResult(existingResult);
  const currentIds = new Set(rows.map((row) => String(row[idColumn])));
  const staleIds = (existingResult.data || [])
    .map((row) => String((row as unknown as Record<string, unknown>)[idColumn]))
    .filter((id) => !currentIds.has(id));
  if (staleIds.length > 0) {
    const deleteResult = await client.from(table).delete().eq('owner_id', ownerId).in(idColumn, staleIds);
    assertResult(deleteResult);
  }
};

const pushUser = async (client: SupabaseClient): Promise<void> => {
  const data = getUser();
  const result = await client.from('profiles').upsert({ owner_id: ownerId, payload: data }, { onConflict: 'owner_id' });
  assertResult(result);
};

const pushCart = async (client: SupabaseClient): Promise<void> => {
  const data = getCart();
  const result = await client.from('carts').upsert({
    owner_id: ownerId,
    merchant_id: data.merchantId,
    payload: data,
  }, { onConflict: 'owner_id' });
  assertResult(result);
};

const pushMerchants = async (client: SupabaseClient): Promise<void> => {
  const rows = getMerchants().map((merchant) => ({
    owner_id: ownerId,
    id: merchant.id,
    name: merchant.name,
    accepting_orders: merchant.acceptingOrders,
    payload: merchant,
  }));
  await replaceOwnedRows(client, 'merchants', 'id', rows);
};

const pushProducts = async (client: SupabaseClient): Promise<void> => {
  const rows = getProducts().map((product) => ({
    owner_id: ownerId,
    id: product.id,
    merchant_id: product.merchantId,
    name: product.name,
    price: product.price,
    available: product.available,
    payload: product,
  }));
  await replaceOwnedRows(client, 'products', 'id', rows);
};

const pushOrders = async (client: SupabaseClient): Promise<void> => {
  const rows = getOrders().map((order) => ({
    owner_id: ownerId,
    order_id: order.orderId,
    client_request_id: order.clientRequestId,
    merchant_id: order.merchantId,
    status: order.status,
    total_amount: order.totalAmount,
    created_at: order.createdAt,
    payload: order,
  }));
  await replaceOwnedRows(client, 'orders', 'order_id', rows);
};

const pushAnalytics = async (client: SupabaseClient): Promise<void> => {
  const rows = getAnalyticsEvents().map((event) => ({
    owner_id: ownerId,
    event_id: event.eventId,
    event_type: event.eventType,
    occurred_at: event.timestamp,
    payload: event,
  }));
  await replaceOwnedRows(client, 'analytics_events', 'event_id', rows);
};

const pushBucket = async (client: SupabaseClient, bucket: Bucket): Promise<void> => {
  if (bucket === 'user') await pushUser(client);
  else if (bucket === 'cart') await pushCart(client);
  else if (bucket === 'merchants') await pushMerchants(client);
  else if (bucket === 'products') await pushProducts(client);
  else if (bucket === 'orders') await pushOrders(client);
  else await pushAnalytics(client);
  recentLocalPush.set(bucket, Date.now());
};

const applyRemote = (action: () => void): void => {
  applyingRemote = true;
  try {
    action();
  } finally {
    applyingRemote = false;
  }
};

const pullBucket = async (client: SupabaseClient, bucket: Bucket): Promise<void> => {
  if (bucket === 'user') {
    const data = await selectSinglePayload<UserData>(client, 'profiles');
    if (data) applyRemote(() => { saveUser(data); });
    return;
  }
  if (bucket === 'cart') {
    const data = await selectSinglePayload<Cart>(client, 'carts');
    if (data) applyRemote(() => { saveCart(data); });
    return;
  }
  if (bucket === 'merchants') {
    const data = await selectPayloads<Merchant>(client, 'merchants');
    applyRemote(() => { saveMerchants(data); });
    return;
  }
  if (bucket === 'products') {
    const data = await selectPayloads<MealRecommendation>(client, 'products');
    applyRemote(() => { saveProducts(data); });
    return;
  }
  if (bucket === 'orders') {
    const data = await selectPayloads<Order>(client, 'orders', 'created_at');
    applyRemote(() => { saveOrders(data); });
    return;
  }
  const data = await selectPayloads<AnalyticsEvent>(client, 'analytics_events', 'occurred_at');
  applyRemote(() => {
    saveAnalyticsEvents(data.sort((a, b) => a.timestamp.localeCompare(b.timestamp)));
    window.dispatchEvent(new Event('analytics_updated'));
  });
};

const bootstrapBucket = async (client: SupabaseClient, bucket: Bucket): Promise<void> => {
  if (bucket === 'user' || bucket === 'cart') {
    const table = bucket === 'user' ? 'profiles' : 'carts';
    const remote = await selectSinglePayload(client, table);
    if (remote) await pullBucket(client, bucket);
    else await pushBucket(client, bucket);
    return;
  }

  const table = Object.entries(TABLE_BUCKETS).find(([, value]) => value === bucket)?.[0];
  if (!table) return;
  const remote = await selectPayloads(client, table);
  if (remote.length > 0) await pullBucket(client, bucket);
  else await pushBucket(client, bucket);
};

const enqueue = (task: () => Promise<void>): void => {
  syncQueue = syncQueue.then(task).catch(() => {
    setStatus('error');
  });
};

const registerLocalListeners = (client: SupabaseClient): void => {
  if (listenersRegistered) return;
  (Object.entries(BUCKET_EVENTS) as [Bucket, string][]).forEach(([bucket, eventName]) => {
    window.addEventListener(eventName, () => {
      if (applyingRemote) return;
      enqueue(async () => {
        await pushBucket(client, bucket);
        setStatus('connected');
      });
    });
  });
  listenersRegistered = true;
};

const subscribeToRemoteChanges = (client: SupabaseClient): void => {
  if (realtimeChannel) return;
  let channel = client.channel('healthgenie-' + ownerId);
  Object.entries(TABLE_BUCKETS).forEach(([table, bucket]) => {
    channel = channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter: 'owner_id=eq.' + ownerId },
      () => {
        if (Date.now() - (recentLocalPush.get(bucket) || 0) < 1500) return;
        enqueue(async () => {
          await pullBucket(client, bucket);
          setStatus('connected');
        });
      },
    );
  });
  realtimeChannel = channel.subscribe();
};

const initialize = async (): Promise<CloudDatabaseStatus> => {
  if (!isSupabaseConfigured) {
    setStatus('disabled');
    return status;
  }

  setStatus('connecting');
  const client = getSupabaseClient();
  if (!client) {
    setStatus('disabled');
    return status;
  }

  try {
    ownerId = await getOwner(client);
    const buckets: Bucket[] = ['user', 'cart', 'merchants', 'products', 'orders', 'analytics'];
    for (const bucket of buckets) await bootstrapBucket(client, bucket);
    registerLocalListeners(client);
    subscribeToRemoteChanges(client);
    setStatus('connected');
  } catch {
    setStatus('error');
  }
  return status;
};

export const initializeCloudDatabase = (): Promise<CloudDatabaseStatus> => {
  if (!initialization) initialization = initialize();
  return initialization;
};

export const refreshFromCloud = (): Promise<void> => {
  const client = getSupabaseClient();
  if (!client || !ownerId) return Promise.resolve();
  return Promise.all((Object.keys(BUCKET_EVENTS) as Bucket[]).map((bucket) => pullBucket(client, bucket))).then(() => undefined);
};
