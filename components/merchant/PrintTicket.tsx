import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Order } from '../../types';
import { formatDateTime } from '../../utils/format';
import { slotLabel } from '../../utils/hours';
import { formatCurrency } from '../../utils/pricing';

/**
 * 廚房出單：只在列印時顯示（寬度適合 58／80mm 感熱紙）。
 * 畫面上看不到，按下「列印」後會開啟瀏覽器或桌面版的列印視窗。
 */
export const PrintTicket: React.FC<{ order: Order; onDone: () => void }> = ({ order, onDone }) => {
  useEffect(() => {
    const finish = () => onDone();
    window.addEventListener('afterprint', finish);
    const timer = window.setTimeout(() => {
      window.print();
    }, 50);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('afterprint', finish);
    };
  }, [onDone]);

  const target = document.getElementById('print-root');
  if (!target) return null;
  return createPortal(
    <div className="print-ticket">
      <p className="pt-center pt-small">{order.merchantName}</p>
      <p className="pt-center pt-number">#{order.orderNumber.split('-')[1] || order.orderNumber}</p>
      <p className="pt-center pt-bold">{order.fulfillment === 'pickup' ? '自取' : '外送'}{order.scheduledFor ? `｜預約 ${slotLabel(new Date(order.scheduledFor))}` : '｜盡快'}</p>
      <p className="pt-small">下單 {formatDateTime(order.createdAt)}　單號 {order.orderNumber}</p>
      <p className="pt-small">{order.contactName}　{order.contactPhone}</p>
      {order.fulfillment === 'delivery' && <p className="pt-small">地址：{order.deliveryAddress}</p>}
      <hr />
      {order.items.map((item, index) => (
        <div key={`${item.productId}-${index}`} className="pt-item">
          <p className="pt-bold">{item.quantity} × {item.name}</p>
          {item.options.length > 0 && <p>　{item.options.map((option) => option.name).join('、')}</p>}
          {item.remark && <p className="pt-bold">　※ {item.remark}</p>}
        </div>
      ))}
      {order.note && (<><hr /><p className="pt-bold">備註：{order.note}</p></>)}
      <hr />
      <p className="pt-row"><span>小計</span><span>{formatCurrency(order.subtotal)}</span></p>
      {order.deliveryFee > 0 && <p className="pt-row"><span>外送費</span><span>{formatCurrency(order.deliveryFee)}</span></p>}
      {order.serviceFee > 0 && <p className="pt-row"><span>服務費</span><span>{formatCurrency(order.serviceFee)}</span></p>}
      {order.discount > 0 && <p className="pt-row"><span>折扣</span><span>-{formatCurrency(order.discount)}</span></p>}
      <p className="pt-row pt-bold"><span>合計</span><span>{formatCurrency(order.total)}</span></p>
      <p className="pt-small">現金付款・{order.paymentStatus === 'paid' ? '已收款' : '未收款'}</p>
    </div>,
    target,
  );
};
