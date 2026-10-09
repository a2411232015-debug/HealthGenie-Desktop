import React from 'react';
import { CONTACT_EMAIL, OPERATOR_NAME, PLATFORM_NAME, POLICY_UPDATED_AT } from '../../lib/config';
import { card } from '../ui';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-2">
    <h2 className="text-lg font-black text-slate-900">{title}</h2>
    <div className="space-y-2 text-sm leading-relaxed text-slate-700">{children}</div>
  </section>
);

const Contact: React.FC = () => (
  CONTACT_EMAIL
    ? <a href={`mailto:${CONTACT_EMAIL}`} className="font-bold text-teal-700 hover:underline">{CONTACT_EMAIL}</a>
    : <span>本平台客服（聯絡信箱將於正式營運時公布）</span>
);

const Shell: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <article className={`${card} mx-auto max-w-3xl space-y-6 p-6 md:p-10`}>
    <header>
      <h1 className="text-2xl font-black text-slate-900">{title}</h1>
      <p className="mt-1 text-xs text-slate-400">最後更新：{POLICY_UPDATED_AT}</p>
    </header>
    {children}
    <footer className="border-t border-slate-100 pt-4 text-xs text-slate-400">
      <a href="#/privacy" className="hover:underline">隱私權政策</a>　·　<a href="#/terms" className="hover:underline">服務條款</a>
    </footer>
  </article>
);

export const PrivacyPage: React.FC = () => (
  <Shell title="隱私權政策">
    <p className="text-sm leading-relaxed text-slate-700">
      {PLATFORM_NAME}（以下稱「本平台」）由 {OPERATOR_NAME} 營運。我們依照《個人資料保護法》蒐集、處理及利用你的個人資料，說明如下。
    </p>
    <Section title="一、我們蒐集哪些資料">
      <p><b>帳號資料：</b>Email、暱稱，以及你選擇填寫的手機號碼與常用地址。</p>
      <p><b>訂單資料：</b>訂購人姓名、電話、外送地址、訂單內容、金額與時間。</p>
      <p><b>健康資料（選填）：</b>性別、年齡、身高、體重、目標體重、活動量、飲食紀錄與體重紀錄。這些資料只有你本人看得到，不會提供給店家。</p>
      <p><b>店家資料：</b>申請開店時提供的店名、電話、地址、營業資訊與菜單。</p>
      <p><b>照片：</b>使用 AI 估算熱量時上傳的餐點照片，只用於當次分析，不會保存。</p>
    </Section>
    <Section title="二、使用目的">
      <p>提供點餐、訂單通知與配送、客服、計算每日熱量目標與推薦餐點、維護平台安全與防止濫用，以及統計分析（不會識別個人）。</p>
    </Section>
    <Section title="三、提供給誰">
      <p>你下單時，<b>訂購人姓名、電話、外送地址與訂單內容</b>會提供給你點餐的店家，讓店家製作與聯絡你。除此之外，我們不會把你的個人資料提供或販售給第三方，但依法令要求者除外。</p>
      <p>本平台使用以下服務處理資料：Supabase（資料庫與登入，資料可能儲存在台灣以外的地區）、Google Gemini（僅限你主動使用的 AI 估算功能）。</p>
    </Section>
    <Section title="四、保存期間">
      <p>帳號存續期間我們會保存你的資料。你刪除帳號後，健康資料與聯絡資料會立即刪除；訂單的金額與品項紀錄會以不含個人身分的形式保留，供店家對帳。</p>
    </Section>
    <Section title="五、你的權利">
      <p>依《個人資料保護法》第 3 條，你可以查詢、閱覽、要求製給複本、補充或更正、要求停止蒐集處理利用，以及要求刪除你的個人資料。</p>
      <p>大部分資料可以直接在「我的帳戶」修改；在「我的帳戶」最下方也可以自行刪除帳號。其他請求請聯絡：<Contact />。</p>
      <p>你可以選擇不提供健康資料，這不會影響點餐功能，只是無法計算熱量目標。</p>
    </Section>
    <Section title="六、資料安全">
      <p>我們使用加密連線、資料庫權限控管（每位使用者只能讀取自己的資料）等方式保護你的資料。</p>
    </Section>
    <Section title="七、政策修改">
      <p>本政策修改時會公告在此頁面。重大變更時，我們會在你登入時另行通知。</p>
    </Section>
  </Shell>
);

export const TermsPage: React.FC = () => (
  <Shell title="服務條款">
    <p className="text-sm leading-relaxed text-slate-700">
      歡迎使用 {PLATFORM_NAME}。註冊或使用本平台，即表示你同意以下條款。
    </p>
    <Section title="一、平台角色">
      <p>本平台提供店家上架餐點、顧客線上點餐的服務。餐點由各店家製作與販售，<b>餐點品質、食品安全、價格與發票由店家負責</b>；本平台負責維護點餐系統。</p>
    </Section>
    <Section title="二、帳號">
      <p>請提供正確的資料並妥善保管密碼。一個帳號只供一人使用；如發現帳號遭他人使用，請立即修改密碼並通知我們。</p>
    </Section>
    <Section title="三、訂單與付款">
      <p>訂單金額以送出時系統計算的金額為準。目前採現金付款，於取餐或送達時付給店家。</p>
      <p>店家接單前，你可以在訂單頁自行取消；店家接單後如需取消，請直接聯絡店家。店家可能因售完、忙碌等原因無法接單，會告知原因。</p>
      <p>預約訂單請於預約時間取餐。多次下單未取餐，平台得限制帳號使用。</p>
    </Section>
    <Section title="四、營養資訊與健康功能">
      <p>餐點營養標示由店家提供或由 AI 估算，可能與實際有差異；每日熱量目標依公式推估。<b>這些資訊僅供一般參考，不能取代醫師或營養師的專業建議。</b>有特殊疾病、懷孕或食物過敏者，請先諮詢專業人員並直接向店家確認食材。</p>
    </Section>
    <Section title="五、店家責任">
      <p>店家應依法辦理食品業者登錄，確保菜單、價格、過敏原與營養資訊正確，並依法開立發票。違反規定或經多次檢舉，平台得停止其上架。</p>
    </Section>
    <Section title="六、禁止行為">
      <p>禁止惡意下單、冒用他人資料、干擾系統運作、上架違法商品，或以任何方式取得他人個人資料。</p>
    </Section>
    <Section title="七、條款修改與聯絡方式">
      <p>本條款修改時會公告在此頁面。如有疑問請聯絡：<Contact />。</p>
    </Section>
  </Shell>
);
