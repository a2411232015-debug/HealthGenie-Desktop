import React, { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2, UtensilsCrossed } from 'lucide-react';
import { createProduct, deleteProduct, fetchProducts, setProductAvailable, updateProduct } from '../../lib/api';
import { useQuery } from '../../lib/useQuery';
import { Merchant, Product } from '../../types';
import { formatNumber } from '../../utils/format';
import { errorMessage, showToast } from '../../utils/notifications';
import { formatCurrency } from '../../utils/pricing';
import { ConfirmDialog, EmptyState, ErrorState, PageLoading, card, primaryButton } from '../ui';
import { ProductForm } from './ProductForm';

export const MenuManager: React.FC<{ merchant: Merchant }> = ({ merchant }) => {
  const query = useQuery(() => fetchProducts([merchant.id]), [merchant.id]);
  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [busyId, setBusyId] = useState('');
  const products = query.data || [];
  const categories = useMemo(() => [...new Set(products.map((product) => product.category).filter(Boolean))], [products]);
  const grouped = useMemo(() => {
    const map = new Map<string, Product[]>();
    products.forEach((product) => map.set(product.category || '未分類', [...(map.get(product.category || '未分類') || []), product]));
    return [...map.entries()];
  }, [products]);

  const toggle = async (product: Product) => {
    setBusyId(product.id);
    try {
      await setProductAvailable(product.id, !product.available);
      query.setData((current) => (current || []).map((item) => (item.id === product.id ? { ...item, available: !product.available } : item)));
      showToast(product.available ? `「${product.name}」已設為售完` : `「${product.name}」恢復供應`);
    } catch (caught) {
      showToast(errorMessage(caught), 'error');
    } finally {
      setBusyId('');
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusyId(deleting.id);
    try {
      await deleteProduct(deleting.id);
      query.setData((current) => (current || []).filter((item) => item.id !== deleting.id));
      showToast('餐點已刪除');
    } catch (caught) {
      showToast(errorMessage(caught), 'error');
    } finally {
      setBusyId('');
      setDeleting(null);
    }
  };

  if (query.loading && !query.data) return <PageLoading />;
  if (query.error) return <ErrorState message={query.error} onRetry={() => void query.reload()} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">共 {products.length} 道餐點，售完的餐點顧客仍看得到但無法點。</p>
        <button onClick={() => setEditing('new')} className={primaryButton}><Plus className="h-4 w-4" />新增餐點</button>
      </div>
      {products.length === 0 ? (
        <EmptyState icon={<UtensilsCrossed className="h-12 w-12" />} title="還沒有餐點" text="新增第一道餐點，記得填寫營養標示，顧客會更願意下單。" action={<button onClick={() => setEditing('new')} className={primaryButton}><Plus className="h-4 w-4" />新增餐點</button>} />
      ) : grouped.map(([category, items]) => (
        <section key={category}>
          <h3 className="mb-2 font-black text-slate-800">{category}</h3>
          <div className={`${card} divide-y divide-slate-100`}>
            {items.map((product) => (
              <article key={product.id} className="flex flex-wrap items-center gap-4 p-4">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                  {product.imageUrl ? <img src={product.imageUrl} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-slate-300"><UtensilsCrossed className="h-6 w-6" /></div>}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-slate-900">{product.name}</h4>
                  <p className="text-sm text-slate-500">
                    {formatCurrency(product.price)}
                    {product.nutrition.calories !== undefined ? ` · ${formatNumber(product.nutrition.calories, 'kcal')}` : ' · 未填營養標示'}
                    {product.optionGroups.length > 0 && ` · ${product.optionGroups.length} 組規格`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => toggle(product)} disabled={busyId === product.id} className={`rounded-full px-3 py-1.5 text-xs font-bold ${product.available ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}>
                    {product.available ? '供應中' : '已售完'}
                  </button>
                  <button onClick={() => setEditing(product)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label={`編輯 ${product.name}`}><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => setDeleting(product)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`刪除 ${product.name}`}><Trash2 className="h-4 w-4" /></button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}

      {editing && (
        <ProductForm
          product={editing === 'new' ? undefined : editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSubmit={async (input) => {
            if (editing === 'new') {
              const created = await createProduct(merchant.id, input);
              query.setData((current) => [...(current || []), created]);
              showToast('餐點已上架');
            } else {
              const updated = await updateProduct(editing.id, input);
              query.setData((current) => (current || []).map((item) => (item.id === updated.id ? updated : item)));
              showToast('餐點已更新');
            }
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog title="刪除餐點？" message={`「${deleting.name}」會從菜單移除，無法復原。過去的訂單紀錄不受影響。如果只是暫時沒貨，建議改成「已售完」。`} confirmLabel="刪除" danger busy={busyId === deleting.id} onCancel={() => setDeleting(null)} onConfirm={remove} />
      )}
    </div>
  );
};
