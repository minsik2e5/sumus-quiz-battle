"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { ChangeEvent, FormEvent, MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { listingPhotoNames, actualListingPhotos } from "../lib/listing";
import { buildMonthlyLedger } from "../lib/finance";
import { Pricing } from "../lib/Pricing";
import { apiFetch } from "../lib/cloud";
import { useLedgerSync } from "../lib/use-ledger-sync";
import { validateState, serializeState, validDate, businessDate } from "../lib/state";
import { marketplaceLinks, registrationState, type MarketplaceLink } from "../lib/marketplace";

type View = "home" | "inventory" | "evidence" | "products" | "buy" | "money" | "season" | "queue" | "analytics" | "market" | "settings" | "pricing";
type Attachment = { name: string; type: string; size: number; data?: string; key?: string; url?: string; kind?: "reference"; sourceUrl?: string; sourceImageUrl?: string };
type Listing = {
  title: string; categoryId: string; apparelSize: string; bottomSize: string;
  condition: string; description: string; price: number; shippingType: string;
  shippingFee: number; convenience: string; halfShipping: number; directDeal: string;
  regionId: string; meetingPlace: string; tags: string[]; imageNames: string[]; quantity: number;
};
type Item = {
  marketplaceLinks?: MarketplaceLink[];
  listingMatchStatus?: string;
  originalId?: string;
  editBase?: string;
  preSaleStatus?:string;
  archivedStatus?: string;
  transactionHistory?: Record<string, unknown>[];
  priceHistory?: {from:number;to:number;at:string}[];
  id: string; acquiredDate: string; brand: string; name: string; model: string; category: string;
  season: string; peakFrom: number; peakTo: number; exitMonth: number; size: string; color: string;
  condition: string; purchaseSource: string; purchasePrice: number; buyShipping: number; repairCost: number;
  purchasePayment: string; purchaseMemo: string;
  expectedPrice: number; minimumPrice: number; registeredDate: string; inventoryStatus: string;
  listingStatus: string; saleDate: string; actualPrice: number; fee: number; shipping: number;
  saleChannel: string; views: number; likes: number; chats: number; priceCuts: number;
  attachments: Attachment[]; productPhotos: Attachment[]; listing: Listing;
  location: string; retailPrice: number; settlementStatus: string; notes: string; photoUrl: string;
  returnDate: string; returnReason: string; turnoverDays: number; dataIssues: string[];
  returnDisposition: string; refundAmount: number; returnShipping: number; archivedAt: string;
  saleTransactionId: string; listingUrl: string; listingPublishedDate: string; listingPublishedPrice: number;
  purchaseHistory: { from: number; to: number; at: string }[];
  estimatedFields?: string[];
  importedAt: string; updatedAt: string;
};
type Account = { id: string; name: string; balance: number };
type Debt = {
  id: string; name: string; remaining: number; plannedPrincipal: number; interestCost: number;
  nextPaymentDate: string; paid: boolean; lastPaidDate: string;
  lastPaidPrincipal?:number; priorRemaining?:number; paymentHistory?:{id:string;date:string;principal:number;interest:number;cancelled:boolean}[];
};
type Snapshot = { id: string; date: string; brand: string; model: string; size: string; price: number; source: string; note: string };
type MarketListing = {
  id: string; title: string; brand: string; model: string; category: string; size: string; color: string;
  price: number; url: string; imageUrl: string; firstSeen: string; lastSeen: string; active: boolean;
  endedReason?: string; soldConfirmed?: boolean;
};
type State = {
  schemaVersion: 6; items: Item[]; accounts: Account[]; debts: Debt[];
  settings: { reserveCash: number; fixedExpenses: number; targetRoi: number; targetProfit: number; feeRate: number; defaultShipping: number };
  snapshots: Snapshot[]; marketListings: MarketListing[]; audit: { at: string; action: string }[];
};

const KEY = "resell_os_v4_state";
const productPhotoFor = (item: Item) => { const photo=actualListingPhotos(item.productPhotos || [])[0] || item.productPhotos?.[0]; return photo?.url || photo?.data || item.photoUrl || ""; };

const today = businessDate;
const won = (n: number) => `${Math.round(Number(n) || 0).toLocaleString("ko-KR")}원`;
const uid = (prefix = "ID") => `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
const median = (values: number[]) => {
  const sorted = values.filter(Boolean).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};
const normalize = (value: string) => String(value || "").toLowerCase().replace(/\[[^\]]*]/g, " ").replace(/[^0-9a-z가-힣]+/g, " ").trim();
const parseCsv = (text: string) => {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === "\"") {
      if (quoted && source[i + 1] === "\"") { cell += "\""; i++; } else quoted = !quoted;
    } else if (ch === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((ch === "\n" || ch === "\r") && !quoted) {
      if (ch === "\r" && source[i + 1] === "\n") i++;
      row.push(cell); if (row.some(v => v.trim())) rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  row.push(cell); if (row.some(v => v.trim())) rows.push(row);
  return rows;
};
const days = (a?: string, b?: string) => {
  if (!a) return 0;
  const end = b || today();
  return Math.max(0, Math.round((new Date(`${end}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86400000));
};
const defaultListing = (): Listing => ({
  title: "", categoryId: "", apparelSize: "", bottomSize: "", condition: "3", description: "",
  price: 0, shippingType: "포함", shippingFee: 0, convenience: "둘 다 가능", halfShipping: 0,
  directDeal: "불가능", regionId: "", meetingPlace: "", tags: [], imageNames: [], quantity: 1,
});
const blankItem = (): Item => ({
  id: uid("ST"), acquiredDate: today(), brand: "", name: "", model: "", category: "아우터",
  season: "겨울", peakFrom: 11, peakTo: 1, exitMonth: 3, size: "", color: "", condition: "A",
  purchaseSource: "번개장터", purchasePrice: 0, buyShipping: 0, repairCost: 0, expectedPrice: 0,
  purchasePayment: "계좌이체", purchaseMemo: "",
  minimumPrice: 0, registeredDate: "", inventoryStatus: "등록대기", listingStatus: "미등록",
  saleDate: "", actualPrice: 0, fee: 0, shipping: 0, saleChannel: "번개장터",
  views: 0, likes: 0, chats: 0, priceCuts: 0, attachments: [], productPhotos: [], listing: defaultListing(),
  location: "", retailPrice: 0, settlementStatus: "해당없음", notes: "", photoUrl: "",
  returnDate: "", returnReason: "", returnDisposition: "", refundAmount: 0, returnShipping: 0,
  archivedAt: "", saleTransactionId: "", listingUrl: "", listingPublishedDate: "", listingPublishedPrice: 0,
  purchaseHistory: [], turnoverDays: 0, dataIssues: [], importedAt: new Date().toISOString(), updatedAt: "",
});
const categoryDefaults: Record<string, { size: string; cost: number; categoryId: string }> = {
  "아우터": { size: "M", cost: 90000, categoryId: "320200" },
  "상의": { size: "M", cost: 45000, categoryId: "320100" },
  "하의": { size: "30", cost: 55000, categoryId: "320300" },
  "신발": { size: "270", cost: 90000, categoryId: "320400" },
  "가방": { size: "Free", cost: 60000, categoryId: "430100" },
  "액세서리": { size: "Free", cost: 25000, categoryId: "430200" },
  "기타 의류": { size: "Free", cost: 30000, categoryId: "320900" },
};
const makeDraft = (i:Item):Item => ({...structuredClone(i),originalId:i.originalId||i.id,editBase:i.editBase||serializeState(i)});
const makeSaleDraft = (i:Item):Item => i.inventoryStatus === "판매완료" ? makeDraft(i) : {...makeDraft(i),saleDate:today(),actualPrice:0,fee:0,shipping:0,settlementStatus:"정산대기"};
const transactionRecord = (i:Item, action:string) => ({purchasePrice:i.purchasePrice,buyShipping:i.buyShipping,repairCost:i.repairCost,action,at:new Date().toISOString(),saleTransactionId:i.saleTransactionId,saleDate:i.saleDate,actualPrice:i.actualPrice,fee:i.fee,shipping:i.shipping,settlementStatus:i.settlementStatus,refundAmount:i.refundAmount,returnShipping:i.returnShipping,returnDate:i.returnDate,returnDisposition:i.returnDisposition});
const totalCost = (i: Item) => i.purchasePrice + i.buyShipping + i.repairCost;
const revenue = (i: Item) => Math.max(0, i.actualPrice - (i.refundAmount || 0));
const profit = (i: Item) => revenue(i) - totalCost(i) - i.fee - i.shipping - (i.returnShipping || 0);
function qualityIssues(i: Item) {
  const preserved = (i.dataIssues || []).filter(x => !/매입가|판매금액|판매일|사이즈|상품코드|입고일/.test(x));
  const issues = [...preserved];
  if (totalCost(i) <= 0) issues.push("매입가 확인 필요");
  if (["판매완료", "반품폐기"].includes(i.inventoryStatus) && (!i.saleDate || i.actualPrice <= 0)) issues.push("판매금액·판매일 확인 필요");
  if (!i.size || /^\?/.test(i.size)) issues.push("사이즈 확인 필요");
  if (!i.id || i.id.startsWith("미부여-") || !i.acquiredDate) issues.push("상품코드·입고일 확인 필요");
  return [...new Set(issues)];
}
const fillMissingItem = (source: Item): Item => {
  // IMPORTANT: source inventory values are authoritative.
  // Never invent/overwrite product code, date, size/color or any money/sale fields.
  const item = structuredClone(source);
  const estimated = new Set(item.estimatedFields || []);
  const mark = (field: string) => estimated.add(field);
  const defaults = categoryDefaults[item.category] || categoryDefaults["기타 의류"];
  if (!item.model?.trim()) { item.model = item.name; mark("모델명(운영보조)"); }
  if (!item.listing.title?.trim()) { item.listing.title = `${item.brand} ${item.name} ${item.color} ${item.size}`.trim(); mark("번장상품명(운영보조)"); }
  if (!item.listing.categoryId?.trim()) { item.listing.categoryId = defaults.categoryId; mark("번장카테고리(운영보조)"); }
  if (!item.listing.description?.trim()) {
    item.listing.description = `${item.brand} ${item.name}입니다. 중고 상품 특성상 사진과 상세 상태를 확인한 뒤 구매해 주세요.`;
    mark("상품설명(운영보조)");
  }
  if (!item.listing.price && item.expectedPrice > 0) { item.listing.price = item.expectedPrice; mark("번장판매가(운영보조)"); }
  if (!item.listing.apparelSize && item.size && item.size !== "?" && ["아우터", "상의", "기타 의류"].includes(item.category)) item.listing.apparelSize = item.size;
  if (!item.listing.bottomSize && item.size && item.size !== "?" && item.category === "하의") item.listing.bottomSize = item.size;
  if (!item.listing.tags?.length) item.listing.tags = [item.brand, item.category, item.season].filter(Boolean).slice(0, 5);
  item.estimatedFields = [...estimated];
  item.dataIssues = qualityIssues(item);
  return item;
};
const seed: State = {
  schemaVersion: 6,
  items: [],
  accounts: [{ id: "a1", name: "사업용 통장", balance: 0 }],
  debts: [],
  settings: { reserveCash: 3000000, fixedExpenses: 800000, targetRoi: 20, targetProfit: 30000, feeRate: 0.05, defaultShipping: 4000 },
  snapshots: [],
  marketListings: [],
  audit: [],
};

function migrate(raw: any): State {
  validateState(raw);
  if ([4, 5, 6].includes(raw?.schemaVersion) && Array.isArray(raw.items)) {
    return {
      ...seed, ...raw, schemaVersion: 6,
      settings: { ...seed.settings, ...(raw.settings || {}) },
      accounts: Array.isArray(raw.accounts) ? raw.accounts : seed.accounts,
      debts: Array.isArray(raw.debts) ? raw.debts.map((d: any) => ({
        ...d, id: d.id || uid("DB"), name: d.name || "대출", remaining: Number(d.remaining) || 0,
        plannedPrincipal: Number(d.plannedPrincipal ?? d.monthlyPayment) || 0,
        interestCost: Number(d.interestCost) || 0,
        nextPaymentDate: d.nextPaymentDate || (d.paymentDay ? `${today().slice(0, 8)}${String(d.paymentDay).padStart(2, "0")}` : ""),
        paid: Boolean(d.paid), lastPaidDate: d.lastPaidDate || "",
      })) : seed.debts,
      snapshots: Array.isArray(raw.snapshots) ? raw.snapshots : [],
      marketListings: Array.isArray(raw.marketListings) ? raw.marketListings : [],
      audit: Array.isArray(raw.audit) ? raw.audit : [],
      items: raw.items.map((x: any) => fillMissingItem({
        ...blankItem(), acquiredDate: "", ...x,
        inventoryStatus: x.inventoryStatus === "재고" ? (x.listingStatus === "미등록" ? "등록대기" : "판매중") : x.inventoryStatus,
        attachments: Array.isArray(x.attachments) ? x.attachments : [],
        productPhotos: Array.isArray(x.productPhotos) ? x.productPhotos : [],
        purchaseHistory: Array.isArray(x.purchaseHistory) ? x.purchaseHistory : [],
        dataIssues: Array.isArray(x.dataIssues) ? x.dataIssues : [],
        listing: { ...defaultListing(), ...(x.listing || {}), tags: Array.isArray(x.listing?.tags) ? x.listing.tags : [], imageNames: Array.isArray(x.listing?.imageNames) ? x.listing.imageNames : [] },
      })),
    };
  }
  if (!raw || !Array.isArray(raw.items)) throw new Error("원장 형식 오류");
  return {
    ...seed, ...raw, schemaVersion: 6,
    items: raw.items.map((x: any) => fillMissingItem({
      ...blankItem(), acquiredDate: "", ...x,
      id: x.id || uid("ST"),
      purchaseSource: x.purchaseSource || x.location || "번개장터",
      category: x.category || "의류",
      season: x.season || "미입력",
      inventoryStatus: (x.inventoryStatus || x["재고상태"] || x["상품상태"] || "등록대기") === "재고" ? "등록대기" : (x.inventoryStatus || x["재고상태"] || x["상품상태"] || "등록대기"),
      attachments: Array.isArray(x.attachments) ? x.attachments : [],
      productPhotos: Array.isArray(x.productPhotos) ? x.productPhotos : [],
      purchaseHistory: Array.isArray(x.purchaseHistory) ? x.purchaseHistory : [],
      listing: { ...defaultListing(), ...(x.listing || {}), tags: Array.isArray(x.listing?.tags) ? x.listing.tags : [], imageNames: Array.isArray(x.listing?.imageNames) ? x.listing.imageNames : [] },
    })),
    audit: [{ at: new Date().toISOString(), action: "기존 Seller OS 데이터를 v4 구조로 변환" }],
  };
}

const nav: { id: View; label: string; icon: string }[] = [
  { id: "home", label: "홈", icon: "⌂" },
  { id: "inventory", label: "재고관리", icon: "▦" },
  { id: "queue", label: "번장등록", icon: "↗" },
  { id: "analytics", label: "매출관리", icon: "▥" },
  { id: "pricing", label: "가격·장기재고", icon: "↓" },
  { id: "money", label: "자금·대출", icon: "₩" },
  { id: "evidence", label: "증빙", icon: "▤" },
  { id: "settings", label: "더보기", icon: "•••" },
];
const viewLabels: Record<View, string> = {
  pricing: "가격·장기재고", home: "홈", inventory: "재고관리", queue: "번장등록", analytics: "매출관리",
  money: "자금·대출", evidence: "증빙", settings: "더보기", products: "상품 라이브러리",
  buy: "매입 분석", season: "계절 재고", market: "시세 데이터",
};
const seasonStage = (i: Item) => {
  if (i.inventoryStatus === "판매완료") return "판매완료";
  const now = Number(today().slice(5,7));
  const inPeak = i.peakFrom <= i.peakTo ? now >= i.peakFrom && now <= i.peakTo : now >= i.peakFrom || now <= i.peakTo;
  if (inPeak) return "판매 피크";
  if (now === i.exitMonth || (i.exitMonth === 1 && now === 2)) return "인하 검토";
  if (days(i.acquiredDate) > 365) return "다음 시즌 이월";
  return "정상 선매입";
};

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Home() {
  const [state, setState] = useState<State>(seed);
  const webLedgerRef = useRef(state); webLedgerRef.current = state;
  useEffect(() => {
    const context = (document as Document & {modelContext?:{registerTool:(tool:unknown,options:unknown)=>unknown}}).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try { Promise.resolve(context.registerTool({name:"read_inventory_summary",title:"원장 요약 조회",description:"현재 열린 Deal Hunter 원장의 상품 개수와 상태별 개수를 읽습니다. 가격이나 데이터를 변경하지 않습니다.",inputSchema:{type:"object",properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute(input:unknown){if(!input||typeof input!=="object"||Array.isArray(input)||Object.keys(input).length)throw new Error("빈 입력 객체를 사용해 주세요.");const items=webLedgerRef.current.items;return {total:items.length,archived:items.filter(i=>Boolean(i.archivedAt)).length,statusCounts:items.reduce<Record<string,number>>((out,item)=>{out[item.inventoryStatus]=(out[item.inventoryStatus]||0)+1;return out;},{}),priceChangesEnabled:false};}},{signal:lifecycle.signal})).catch(()=>{}); } catch { /* Unsupported registry leaves the normal UI available. */ }
    return () => lifecycle.abort();
  }, []);
  const [view, setView] = useState<View>("home");
  const [editing, setEditing] = useState<Item | null>(null);
  const [purchaseEditing, setPurchaseEditing] = useState<Item | null>(null);
  const [saleEditing, setSaleEditing] = useState<Item | null>(null);
  const [returnEditing, setReturnEditing] = useState<Item | null>(null);
  const [publishEditing, setPublishEditing] = useState<Item | null>(null);
  const [continuousQueue, setContinuousQueue] = useState(false);
  const [allocation, setAllocation] = useState({ open: false, total: 0, method: "예상판매가 비율", ids: [] as string[] });
  const [search, setSearch] = useState("");
  const [inventoryFilter, setInventoryFilter] = useState("전체");
  const [inventoryViewMode, setInventoryViewMode] = useState<"image" | "text">("image");
  const [registrationFilter, setRegistrationFilter] = useState("전체");
  const [registrationShop, setRegistrationShop] = useState("전체");
  const [inventorySort, setInventorySort] = useState("입고일 최신순");
  const [inventoryOptionsOpen, setInventoryOptionsOpen] = useState(false);
  const [inventoryOptions, setInventoryOptions] = useState({
    category: "전체", condition: "전체", payment: "전체", listing: "전체",
    evidence: "전체", dateFrom: "", dateTo: "",
  });
  const [salesRange, setSalesRange] = useState<6 | 12 | 18>(12);
  const [salesMonth, setSalesMonth] = useState(today().slice(0, 7));
  const [toast, setToast] = useState("");
  const [serverVersions, setServerVersions] = useState<{ id: number; revision: number; createdAt: string }[]>([]);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [restoringVersion, setRestoringVersion] = useState(false);
  const [portableBusy,setPortableBusy] = useState(false);
  const [savingPurchase, setSavingPurchase] = useState(false);
  const salesMonthInitialized = useRef(false);
  const purchaseLock = useRef(false);
  const {enableSync, ready, serverLoading, isSaving, setIsSaving, sync, setSync, loadIssue, setLoadIssue, serverNeedsInitialCommit, setServerNeedsInitialCommit, setLoadNonce, revisionRef, lastSyncedJsonRef, pendingLocalChangesRef} = useLedgerSync(state, setState, seed, migrate);
  const [buy, setBuy] = useState({ brand: "", name: "", size: "", category: "아우터", season: "겨울", source: "번개장터", market: 0, offer: 0, shipping: 4000, repair: 0, holdMonths: 5, evidence: 0 });
  const fileRef = useRef<HTMLInputElement>(null);
  const excelRef = useRef<HTMLInputElement>(null);
  const marketCsvRef = useRef<HTMLInputElement>(null);

  const note = (message: string) => { setToast(message); setTimeout(() => setToast(""), 2600); };
  const update = (fn: (s: State) => State, action?: string) => setState(s => {
    const next = fn(s);
    try { validateState(next); } catch(error) { note(error instanceof Error ? error.message : "입력값을 확인해 주세요."); return s; }
    return action ? { ...next, audit: [{ at: new Date().toISOString(), action }, ...next.audit].slice(0, 500) } : next;
  });

  const active = state.items.filter(i => ["등록대기", "판매중", "예약중", "재고"].includes(i.inventoryStatus) && !i.archivedAt);
  const sold = state.items.filter(i => i.inventoryStatus === "판매완료");
  const recentItems = [...state.items].sort((a, b) => {
    if (!a.acquiredDate && !b.acquiredDate) return 0;
    if (!a.acquiredDate) return 1;
    if (!b.acquiredDate) return -1;
    return b.acquiredDate.localeCompare(a.acquiredDate);
  });
  const validSold = sold.filter(i => Boolean(i.saleDate) && i.actualPrice > 0 && totalCost(i) > 0);
  const reviewItems = state.items.filter(i => qualityIssues(i).length);
  const inventoryCost = active.reduce((s, i) => s + totalCost(i), 0);
  const balances = state.accounts.reduce((s, a) => s + a.balance, 0);
  const upcomingDebt = state.debts.filter(d => !d.paid).reduce((s, d) => s + d.plannedPrincipal + d.interestCost, 0);
  const settlement = sold.filter(i => i.saleDate && i.actualPrice > 0).filter(i => i.settlementStatus === "정산대기").reduce((s, i) => s + i.actualPrice - i.fee - i.shipping, 0);
  const buyable = balances + settlement - state.settings.reserveCash - upcomingDebt - state.settings.fixedExpenses;
  const currentMonth = today().slice(0, 7);
  const monthSold = sold.filter(i => i.saleDate && i.actualPrice > 0).filter(i => i.saleDate.startsWith(currentMonth));
  const monthInterest = state.debts.filter(d => d.lastPaidDate?.startsWith(currentMonth)).reduce((s, d) => s + d.interestCost, 0);
  const monthProfit = buildMonthlyLedger(state.items,state.debts,today()).find(([m])=>m===currentMonth)?.[1].profit || 0;
  const queue = state.items.filter(i => ["등록대기","엑셀생성","테스트완료"].includes(i.listingStatus) && !i.archivedAt && !["판매완료","반품폐기"].includes(i.inventoryStatus));
  const saleComparables = useMemo(() => {
    const brand = normalize(buy.brand); const terms = normalize(buy.name).split(" ").filter(x => x.length >= 2);
    return state.items.filter(i => i.inventoryStatus === "판매완료" && i.actualPrice > 0 && i.purchasePrice > 0 && i.saleDate)
      .filter(i => !brand || normalize(i.brand) === brand)
      .filter(i => !buy.size || !i.size || normalize(i.size) === normalize(buy.size))
      .filter(i => !terms.length || terms.some(term => normalize(`${i.model} ${i.name}`).includes(term)));
  }, [state.items, buy.brand, buy.name, buy.size]);
  const actualSaleMedian = median(saleComparables.map(i => i.actualPrice));
  const actualAvgDays = saleComparables.length ? Math.round(saleComparables.reduce((s, i) => s + days(i.acquiredDate, i.saleDate), 0) / saleComparables.length) : 0;

  const buyFee = buy.market * state.settings.feeRate;
  const holdCost = buy.offer * 0.004 * buy.holdMonths;
  const expectedProfit = buy.market - buy.offer - buy.shipping - buy.repair - buyFee - state.settings.defaultShipping - holdCost;
  const maxByProfit = buy.market - buy.shipping - buy.repair - buyFee - state.settings.defaultShipping - holdCost - state.settings.targetProfit;
  const maxByRoi = (buy.market - buy.shipping - buy.repair - buyFee - state.settings.defaultShipping - holdCost) / (1 + state.settings.targetRoi / 100);
  const maxBuy = Math.max(0, Math.floor(Math.min(maxByProfit, maxByRoi) / 1000) * 1000);
  const buyScore = Math.max(0, Math.min(100, Math.round(
    (buy.offer <= maxBuy ? 34 : Math.max(0, 34 - ((buy.offer - maxBuy) / Math.max(1, maxBuy)) * 100)) +
    Math.min(20, Math.max(buy.evidence, saleComparables.length) * 5) + (expectedProfit >= state.settings.targetProfit ? 22 : 8) +
    (buyable - buy.offer > state.settings.reserveCash * 0.2 ? 16 : 4) + (buy.season === "겨울" ? 8 : 6)
  )));

  const monthly = useMemo(() => buildMonthlyLedger(state.items,state.debts,today()),[state.items,state.debts]);
  useEffect(() => {
    if (salesMonthInitialized.current || serverLoading) return;
    salesMonthInitialized.current = true;
    const selectedHasSales = monthly.find(([month]) => month === salesMonth)?.[1].revenue;
    const latestMonthWithSales = [...monthly].reverse().find(([, row]) => row.revenue > 0)?.[0];
    if (!selectedHasSales && latestMonthWithSales) setSalesMonth(latestMonthWithSales);
  }, [monthly, salesMonth, serverLoading]);

  const groups = useMemo(() => {
    const map = new Map<string, Item[]>();
    state.items.forEach(i => { const key = `${i.brand || "브랜드 미입력"} · ${i.category || "카테고리 미입력"} · ${i.size || "사이즈 미입력"}`; map.set(key, [...(map.get(key) || []), i]); });
    return [...map.entries()].map(([key, items]) => {
      const completed = items.filter(i => i.inventoryStatus === "판매완료" && i.actualPrice > 0 && i.purchasePrice > 0 && i.saleDate);
      const avgDays = completed.length ? completed.reduce((s, i) => s + days(i.registeredDate || i.acquiredDate, i.saleDate), 0) / completed.length : 0;
      const avgProfit = completed.length ? completed.reduce((s, i) => s + profit(i), 0) / completed.length : 0;
      const within90 = completed.length ? completed.filter(i => days(i.registeredDate || i.acquiredDate, i.saleDate) <= 90).length / completed.length * 100 : 0;
      const loss = completed.length ? completed.filter(i => profit(i) < 0).length / completed.length * 100 : 0;
      const score = completed.length < 2 ? null : Math.round(Math.max(0, Math.min(100, within90 * .45 + Math.min(35, avgProfit / 1500) + Math.max(0, 20 - loss))));
      return { key, total: items.length, sold: completed.length, avgDays, avgProfit, within90, loss, score };
    }).sort((a, b) => (b.score || -1) - (a.score || -1));
  }, [state.items]);

  const marketProducts = useMemo(() => {
    const map = new Map<string, MarketListing[]>();
    state.marketListings.forEach(l => {
      const key = `${normalize(l.brand || "브랜드 미입력")}|${normalize(l.model || l.title).split(" ").slice(0, 7).join(" ")}|${normalize(l.category || "의류")}|${normalize(l.size || "-")}|${normalize(l.color || "-")}`;
      map.set(key, [...(map.get(key) || []), l]);
    });
    return [...map.entries()].map(([key, listings]) => {
      const freshActive = listings.filter(x => x.active && days(x.lastSeen) <= 45);
      const prices = freshActive.map(x => x.price).filter(Boolean);
      const comparable = prices;
      const sample = listings[0];
      const brand = sample.brand || "브랜드 미입력", model = sample.model || sample.title, size = sample.size || "-";
      const activeCount = listings.filter(x => x.active).length;
      const ended = listings.length - activeCount;
      const soldConfirmed = listings.filter(x => x.soldConfirmed).length;
      const observedDays = listings.filter(x => x.soldConfirmed).map(x => days(x.firstSeen, x.lastSeen || undefined)).filter(Boolean);
      return {
        key, brand, model, size, category: sample.category, color: sample.color, listings, activeCount, ended, soldConfirmed, freshCount: freshActive.length,
        median: median(comparable),
        low: comparable.length ? Math.min(...comparable) : 0,
        avgDays: observedDays.length ? Math.round(observedDays.reduce((a, b) => a + b, 0) / observedDays.length) : 0,
      };
    }).sort((a, b) => b.listings.length - a.listings.length);
  }, [state.marketListings]);

  const aiCandidates = useMemo(() => marketProducts.filter(p => p.median > 0 && p.freshCount > 0).map(p => {
    const offer = p.low || p.median;
    const net = Math.round(p.median * (1 - state.settings.feeRate) - offer - state.settings.defaultShipping);
    const roi = offer ? net / offer * 100 : 0;
    const discount = p.median ? (p.median - offer) / p.median * 100 : 0;
    const evidence = Math.min(12, p.freshCount * 2);
    const score = Math.round(Math.max(0, Math.min(100,
      Math.min(35, Math.max(0, discount * 1.25)) +
      Math.min(25, Math.max(0, net / Math.max(1, state.settings.targetProfit) * 25)) +
      Math.min(20, Math.max(0, roi / Math.max(1, state.settings.targetRoi) * 20)) +
      evidence + (p.soldConfirmed > 0 && p.avgDays && p.avgDays <= 60 ? 8 : p.soldConfirmed > 0 && p.avgDays <= 120 ? 5 : 2)
    )));
    const verdict = score >= 80 && net >= state.settings.targetProfit && roi >= state.settings.targetRoi ? "적극 매입" : score >= 65 && net > 0 ? "매입 추천" : score >= 48 && net > 0 ? "조건부 매입" : "패스";
    return { ...p, offer, net, roi, discount, score, verdict, confidence: p.freshCount >= 5 && p.soldConfirmed >= 2 ? "높음" : p.freshCount >= 3 || p.soldConfirmed >= 1 ? "보통" : "낮음" };
  }).sort((a, b) => b.score - a.score), [marketProducts, state.settings]);

  const staleDraft = (i:Item) => Boolean(i.editBase && serializeState(state.items.find(x => x.id === (i.originalId||i.id))) !== i.editBase);
  const saveItem = (e: { preventDefault: () => void }, createNext = false) => {
    e.preventDefault(); if (!editing) return;
    if (staleDraft(editing)) return note("다른 기기에서 상품이 변경됐어요. 창을 닫고 최신 상품을 다시 열어 주세요.");
    if (!editing.id.trim()) return note("상품코드를 입력해 주세요.");
    if (state.items.some(i => i.id === editing.id && i.id !== editing.originalId)) return note("이미 사용 중인 상품코드예요.");
    try { validateState({...state,items:[editing]}); } catch { return note("금액과 날짜를 확인해 주세요."); }
    const normalized = { ...editing, dataIssues: qualityIssues(editing), updatedAt: new Date().toISOString(), listing: { ...editing.listing, title: editing.listing.title || `${editing.brand} ${editing.name} ${editing.color} ${editing.size}`.trim(), price: editing.listing.price || editing.expectedPrice, apparelSize: editing.listing.apparelSize || editing.size } };
    const originalId = editing.originalId || editing.id;
    delete normalized.originalId;
    delete normalized.editBase;
    update(s => ({ ...s, items: s.items.some(i => i.id === originalId) ? s.items.map(i => i.id === originalId ? normalized : i) : [normalized, ...s.items] }), `${normalized.id} 상품 저장`);
    if (continuousQueue && editing.originalId) {
      const candidates = state.items.filter(i => ["등록대기", "엑셀생성"].includes(i.listingStatus) && !i.archivedAt);
      const currentIndex = candidates.findIndex(i => i.id === originalId);
      const next = candidates[currentIndex + 1];
      if (next) {
        setEditing({ ...makeDraft(next)});
        note(`저장했어요. 다음 등록대기 상품으로 이동했습니다. (${Math.max(0, candidates.length - currentIndex - 1)}개 남음)`);
      } else {
        setContinuousQueue(false); setEditing(null); note("등록대기 상품을 모두 수정했어요.");
      }
    } else if (createNext) {
      const next = blankItem();
      next.purchaseSource = normalized.purchaseSource;
      next.listing.shippingType = normalized.listing.shippingType;
      next.listing.shippingFee = normalized.listing.shippingFee;
      next.listing.convenience = normalized.listing.convenience;
      setEditing(next);
      note("저장했어요. 다음 상품을 바로 입력하세요.");
    } else {
      setEditing(null); note("상품 정보를 저장했어요.");
    }
  };
  const uploadAttachments = async (files: File[]) => {
    if (files.some(f => f.size > 8_000_000)) return note("파일당 8MB 이하로 첨부해 주세요.");
    try {
      const uploaded: Attachment[] = [];
      for (const file of files) {
        const form = new FormData(); form.append("file", file);
        const response = await apiFetch("/api/files", { method: "POST", body: form });
        if (!response.ok) throw new Error("upload failed");
        uploaded.push(await response.json());
      }
      return uploaded;
    } catch { note("파일 저장에 실패했어요. 잠시 후 다시 시도해 주세요."); }
  };
  const addProductPhotos = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!editing || !e.target.files?.length) return;
    if ([...e.target.files].some(f => !["image/jpeg","image/png","image/webp","image/gif"].includes(f.type))) return note("JPG·PNG·WEBP·GIF 사진만 추가해 주세요.");
    const uploaded = await uploadAttachments([...e.target.files]);
    if (uploaded) {
      setEditing(current => current && current.id === editing.id ? { ...current, productPhotos: [...current.productPhotos, ...uploaded], listing: {...current.listing, imageNames:[...current.listing.imageNames,...uploaded.map(a => a.name)]} } : current);
      note(`${uploaded.length}개 상품 사진을 저장했어요.`);
    }
    e.target.value = "";
  };
  const addPurchaseEvidence = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!purchaseEditing || !e.target.files?.length) return;
    const uploaded = await uploadAttachments([...e.target.files]);
    if (uploaded) {
      setPurchaseEditing(current => current && current.id === purchaseEditing.id ? {...current,attachments:[...current.attachments,...uploaded]} : current);
      note(`${uploaded.length}개 매입증빙을 저장했어요.`);
    }
    e.target.value = "";
  };
  const removeProductPhoto = async (index: number) => {
    if (!editing) return;
    setEditing({ ...editing, productPhotos: editing.productPhotos.filter((_, n) => n !== index), listing:{...editing.listing,imageNames:editing.listing.imageNames.filter(n => n !== editing.productPhotos[index]?.name)} });
  };
  const removePurchaseEvidence = async (index: number) => {
    if (!purchaseEditing) return;
    setPurchaseEditing({ ...purchaseEditing, attachments: purchaseEditing.attachments.filter((_, n) => n !== index) });
  };
  const savePurchase = (e: { preventDefault: () => void }, createNext = false) => {
    e.preventDefault(); if (!purchaseEditing || purchaseLock.current) return;
    if (staleDraft(purchaseEditing)) return note("다른 기기에서 상품이 변경됐어요. 창을 닫고 최신 상품을 다시 열어 주세요.");
    if (!purchaseEditing.name.trim()) return note("상품명을 입력해 주세요.");
    if (!validDate(purchaseEditing.acquiredDate)) return note("매입일을 입력해 주세요.");
    if (!Number.isFinite(purchaseEditing.purchasePrice) || purchaseEditing.purchasePrice <= 0 || [purchaseEditing.buyShipping,purchaseEditing.repairCost].some(n=>!Number.isFinite(n)||n<0)) return note("매입가격을 입력해 주세요.");
    if (state.items.some(i => i.id === purchaseEditing.id && i.id !== purchaseEditing.originalId)) return note("이미 사용 중인 상품코드예요.");
    const duplicate = !purchaseEditing.originalId && state.items.some(i =>
      normalize(i.name) === normalize(purchaseEditing.name) &&
      i.acquiredDate === purchaseEditing.acquiredDate &&
      i.purchasePrice === purchaseEditing.purchasePrice
    );
    if (duplicate && !confirm("같은 상품명·매입일·매입가의 기록이 이미 있어요. 그래도 저장할까요?")) return;
    purchaseLock.current = true;
    setSavingPurchase(true);
    const originalId = purchaseEditing.originalId || purchaseEditing.id;
    const before = state.items.find(i => i.id === originalId);
    const priceChanged = before && before.purchasePrice !== purchaseEditing.purchasePrice;
    const normalized = {
      ...purchaseEditing,
      inventoryStatus: purchaseEditing.inventoryStatus || "등록대기",
      purchaseHistory: priceChanged
        ? [{ from: before.purchasePrice, to: purchaseEditing.purchasePrice, at: new Date().toISOString() }, ...(before.purchaseHistory || [])]
        : purchaseEditing.purchaseHistory || [],
      updatedAt: new Date().toISOString(),
    };
    delete normalized.originalId;
    delete normalized.editBase;
    update(s => ({ ...s, items: s.items.some(i => i.id === originalId) ? s.items.map(i => i.id === originalId ? normalized : i) : [normalized, ...s.items] }), priceChanged ? `${normalized.id} 매입가 ${won(before.purchasePrice)} → ${won(normalized.purchasePrice)}` : `${normalized.id} 매입정보 저장`);
    if (createNext) {
      const next = blankItem();
      next.purchaseSource = normalized.purchaseSource;
      setPurchaseEditing(next);
      note("매입을 저장했어요. 다음 상품을 입력하세요.");
    } else {
      setPurchaseEditing(null);
      setInventoryFilter("등록대기");
      setView("inventory");
      note("매입을 저장하고 재고에 추가했어요.");
    }
    window.setTimeout(() => { purchaseLock.current = false; setSavingPurchase(false); }, 500);
  };
  const saveSale = (e: FormEvent) => {
    e.preventDefault(); if (!saleEditing) return;
    if (staleDraft(saleEditing)) return note("다른 기기에서 상품이 변경됐어요. 창을 닫고 최신 상품을 다시 열어 주세요.");
    if (!validDate(saleEditing.saleDate)) return note("판매일을 입력해 주세요.");
    if (!Number.isFinite(saleEditing.actualPrice) || saleEditing.actualPrice <= 0 || [saleEditing.fee,saleEditing.shipping].some(n => !Number.isFinite(n) || n < 0)) return note("실판매가를 입력해 주세요.");
    const stored = state.items.find(i => i.id === saleEditing.id);
    if (!stored) return note("상품 기록을 찾지 못했어요.");
    if (stored.archivedAt) return note("보관함에서 복원한 뒤 판매 처리해 주세요.");
    const normalized = {
      ...saleEditing,
      inventoryStatus: "판매완료",
      preSaleStatus: stored.inventoryStatus === "판매완료" ? stored.preSaleStatus : stored.inventoryStatus,
      saleTransactionId: stored.inventoryStatus === "판매완료" ? (stored.saleTransactionId || uid("SALE")) : uid("SALE"),
      transactionHistory: stored.inventoryStatus === "판매완료" ? (stored.transactionHistory || []) : [...(stored.transactionHistory || []), ...(stored.saleDate ? [transactionRecord(stored,"재판매 이전 거래")] : [])],
      refundAmount: 0, returnShipping: 0, returnDate: "", returnReason: "", returnDisposition: "",
      settlementStatus: saleEditing.settlementStatus === "해당없음" ? "정산대기" : saleEditing.settlementStatus,
      turnoverDays: days(saleEditing.acquiredDate, saleEditing.saleDate),
      updatedAt: new Date().toISOString(),
      dataIssues: qualityIssues({ ...saleEditing, inventoryStatus: "판매완료" }),
    };
    delete normalized.originalId;
    delete normalized.editBase;
    update(s => ({ ...s, items: s.items.map(i => i.id === saleEditing.id ? normalized : i) }), `${saleEditing.id} 판매완료 · 매출 기록`);
    setSaleEditing(null);
    note("판매완료 처리했어요. 매출과 정산에 반영됐습니다.");
  };
  const undoSale = (item: Item) => {
    if(staleDraft(item)) return note("다른 기기에서 변경됐어요. 최신 판매정보를 다시 열어 주세요.");
    if (!confirm("판매 기록과 정산금을 취소하고 재고로 되돌릴까요?")) return;
    update(s => ({ ...s, items: s.items.map(i => i.id === item.id ? {
      ...i, transactionHistory: [...(i.transactionHistory || []), transactionRecord(i,"판매 취소")], inventoryStatus: i.preSaleStatus || "등록대기", refundAmount:0,returnDate:"",returnReason:"",returnDisposition:"",returnShipping:0, saleDate: "", actualPrice: 0, fee: 0, shipping: 0,
      settlementStatus: "해당없음", saleTransactionId: "", turnoverDays: 0, updatedAt: new Date().toISOString(),
    } : i) }), `${item.id} 판매완료 취소 · 재고 복귀`);
    setSaleEditing(null);
    note("판매와 정산 반영을 취소하고 재고로 되돌렸어요.");
  };
  const saveReturn = (e: FormEvent) => {
    e.preventDefault(); if (!returnEditing) return;
    if (staleDraft(returnEditing)) return note("다른 기기에서 상품이 변경됐어요. 창을 닫고 최신 상품을 다시 열어 주세요.");
    if (!validDate(returnEditing.returnDate)) return note("반품일을 입력해 주세요.");
    if (!returnEditing.returnDisposition) return note("반품 상품 처리 방법을 선택해 주세요.");
    const stored = state.items.find(i => i.id === returnEditing.id);
    if (!stored || stored.inventoryStatus !== "판매완료") return note("판매완료 상품만 반품 처리할 수 있습니다.");
    if (![returnEditing.refundAmount, returnEditing.returnShipping].every(n => Number.isFinite(n) && n >= 0) || returnEditing.refundAmount > stored.actualPrice || returnEditing.returnDate < stored.saleDate) return note("환불액과 반품일을 확인해 주세요.");
    const toInventory = returnEditing.returnDisposition === "재고 복귀";
    const normalized = {
      ...returnEditing,
      transactionHistory: [...(stored.transactionHistory || []), transactionRecord({...stored, ...returnEditing},"반품")],
      inventoryStatus: toInventory ? (stored.preSaleStatus || "등록대기") : "반품폐기",
      settlementStatus: "환불완료",
      archivedAt: toInventory ? "" : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    delete normalized.originalId;
    delete normalized.editBase;
    update(s => ({ ...s, items: s.items.map(i => i.id === normalized.id ? normalized : i) }), `${normalized.id} 반품 처리 · ${normalized.returnDisposition}`);
    setReturnEditing(null); setSaleEditing(null);
    note(toInventory ? "환불을 반영하고 상품을 재고로 복귀했어요." : "환불과 반품 비용을 반영하고 보관함으로 이동했어요.");
  };
  const savePublished = (e: FormEvent) => {
    e.preventDefault(); if (!publishEditing) return;
    if (staleDraft(publishEditing)) return note("다른 기기에서 상품이 변경됐어요. 창을 닫고 최신 상품을 다시 열어 주세요.");
    if (!publishEditing.listingPublishedDate) return note("게시일을 입력해 주세요.");
    if (!/^https:\/\/(?:m\.)?bunjang\.co\.kr\//.test(publishEditing.listingUrl.trim())) return note("번장 게시 URL을 입력해 주세요.");
    if (!Number.isFinite(publishEditing.listingPublishedPrice) || publishEditing.listingPublishedPrice <= 0) return note("실제 게시 가격을 입력해 주세요.");
    const normalized = { ...publishEditing, listing: {...publishEditing.listing,price:publishEditing.listingPublishedPrice}, listingStatus: "판매중", inventoryStatus: "판매중", registeredDate: publishEditing.registeredDate || publishEditing.listingPublishedDate, updatedAt: new Date().toISOString() };
    delete normalized.originalId;
    delete normalized.editBase;
    update(s => ({ ...s, items: s.items.map(i => i.id === normalized.id ? normalized : i) }), `${normalized.id} 번장 게시 완료`);
    setPublishEditing(null); note("게시 URL과 판매가격을 저장했어요.");
  };
  const archiveItem = (item: Item) => {
    if (pendingLocalChangesRef.current && sync.conflict) return note("충돌을 먼저 확인해 주세요.");
    if (!confirm(`${item.brand} ${item.name} 상품을 보관함으로 이동할까요?`)) return;
    update(s => ({ ...s, items: s.items.map(i => i.id === item.id ? { ...i, archivedAt: new Date().toISOString(), archivedStatus: i.inventoryStatus } : i) }), `${item.id} 보관함 이동`);
    note("삭제하지 않고 보관함으로 이동했어요.");
  };
  const restoreItem = (item: Item) => {
    if (item.inventoryStatus === "보관함" && !item.archivedStatus) return note("이전 상태가 없는 보관 기록입니다. 상품정보에서 상태를 확인·수정한 뒤 복원해 주세요.");
    update(s => ({ ...s, items: s.items.map(i => i.id === item.id ? { ...i, archivedAt: "", inventoryStatus: i.archivedStatus || i.inventoryStatus } : i) }), `${item.id} 보관함 복원`);
    note("상품을 재고로 복원했어요.");
  };
  const copyItem = (item: Item) => {
    const next = {
      ...structuredClone(item), ...blankItem(), id: uid("ST"), name: `${item.name} 복사본`,
      brand: item.brand, model: item.model, category: item.category, size: item.size, color: item.color,
      condition: item.condition, season: item.season, expectedPrice: item.expectedPrice, minimumPrice: item.minimumPrice,
      productPhotos: [...item.productPhotos], listing: { ...item.listing }, purchasePrice: 0, attachments: [],
      purchaseMemo: "", acquiredDate: today(), inventoryStatus: "등록대기",
    };
    setPurchaseEditing(next);
    note("상품정보만 복사했어요. 매입정보와 증빙은 비워뒀습니다.");
  };

  const loadServerVersions = async () => {
    try {
      const response = await apiFetch("/api/state/versions", { cache: "no-store" });
      if (!response.ok) throw new Error("versions failed");
      const payload = await response.json();
      setServerVersions(Array.isArray(payload.versions) ? payload.versions : []);
      setVersionsOpen(true);
    } catch { note("서버 복원 기록을 불러오지 못했어요."); }
  };
  const restoreServerVersion = async (versionId: number, revision: number) => {
    if (pendingLocalChangesRef.current || isSaving) return note("현재 변경사항 저장이 끝난 뒤 다시 시도해 주세요.");
    if (!confirm(`서버 revision ${revision} 상태로 복원할까요?\n현재 상태도 복원 기록에 자동 보관됩니다.`)) return;
    setRestoringVersion(true);
    try {
      const response = await apiFetch("/api/state/versions", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ versionId, expectedRevision: revisionRef.current }),
      });
      if (response.status === 409) {
        setSync(s => ({ ...s, status: "다른 기기 변경 감지", conflict: true }));
        return note("다른 기기에서 먼저 변경됐어요. 최신 데이터를 다시 불러와 주세요.");
      }
      if (!response.ok) throw new Error("restore failed");
      const payload = await response.json();
      const restored = migrate(payload.state);
      const restoredJson = serializeState(restored);
      revisionRef.current = payload.revision;
      lastSyncedJsonRef.current = restoredJson;
      pendingLocalChangesRef.current = false;
      try { localStorage.setItem(KEY, restoredJson); } catch { note("서버 복원됨 · 브라우저 백업 실패"); }
      setState(restored);
      setSync({ status: `revision ${payload.restoredFromRevision} 복원 완료`, revision: payload.revision, updatedAt: payload.updatedAt, conflict: false });
      setLoadIssue("");
      note("서버 이전 버전을 안전하게 복원했어요.");
      await loadServerVersions();
    } catch { note("서버 버전 복원에 실패했어요."); }
    finally { setRestoringVersion(false); }
  };

  const commitInitialServerState = async () => {
    if (!serverNeedsInitialCommit || isSaving || !state.items.length) return note("검증된 원장을 먼저 가져와 주세요.");
    if (!confirm("현재 PC의 데이터를 새 서버의 최초 기준본으로 저장할까요?\n이 작업은 기존 백업 확인 후 진행하는 것을 권장합니다.")) return;
    try {
      setIsSaving(true);
      const response = await apiFetch("/api/state", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state: JSON.parse(serializeState(state)), expectedRevision: 0 }),
      });
      if (response.status === 409) { setSync(s => ({...s, conflict:true, status:"다른 기기에서 최초 저장됨"})); return; }
      if (!response.ok) throw new Error("initial save failed");
      const payload = await response.json();
      revisionRef.current = payload.revision || 1;
      const currentJson = serializeState(state);
      lastSyncedJsonRef.current = currentJson;
      pendingLocalChangesRef.current = false;
      setServerNeedsInitialCommit(false);
      enableSync();
      setLoadIssue("");
      setSync({ status: "최초 서버 저장 완료", revision: payload.revision || 1, updatedAt: payload.updatedAt || new Date().toISOString(), conflict: false });
      note("현재 데이터를 새 서버의 최초 기준본으로 저장했어요.");
    } catch {
      note("최초 서버 저장에 실패했어요.");
      setSync(s => ({ ...s, status: "최초 서버 저장 실패" }));
    } finally {
      setIsSaving(false);
    }
  };

  const downloadConflictBackup = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      reason: "server-conflict-local-copy",
      revision: revisionRef.current,
      state,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Deal_Hunter_충돌보호_${new Date().toISOString().slice(0,19).replace(/[:T]/g,"-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    note("현재 PC의 변경사항을 JSON으로 보관했어요.");
  };

  const exportBackup = () => {
    download(new Blob([JSON.stringify({ app: "Deal Hunter V5", exportedAt: new Date().toISOString(), state }, null, 2)], { type: "application/json" }), `Deal_Hunter_V5_통합백업_${today().replaceAll("-", "")}.json`);
    note("재고·자금·시세와 증빙 파일 목록이 포함된 백업을 저장했어요.");
  };
  const exportPortableBackup = async () => {
    if (portableBusy) return;
    setPortableBusy(true);
    try {
      const copy = JSON.parse(serializeState(state)) as State;
      const cache = new Map<string,string>();
      for (const i of copy.items) for (const a of [...i.attachments,...i.productPhotos]) {
        if (!a.key && !a.url || a.data) continue;
        const identity = a.key || a.url!;
        if (!cache.has(identity)) {
          let url = a.url;
          if (a.key) { const r = await apiFetch(`/api/files?key=${encodeURIComponent(a.key)}`); if (!r.ok) throw new Error("사진 조회 실패"); url = (await r.json()).url; }
          if (!url) throw new Error("사진 주소 누락");
          const response = await fetch(url); if (!response.ok) throw new Error("사진 다운로드 실패");
          const blob = await response.blob();
          const data = await new Promise<string>((resolve,reject) => { const reader = new FileReader(); reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(blob); });
          cache.set(identity,data);
        }
        a.data = cache.get(identity); delete a.url; delete a.key;
      }
      download(new Blob([JSON.stringify({app:"Deal Hunter V5",portable:true,exportedAt:new Date().toISOString(),state:copy})],{type:"application/json"}),`Deal_Hunter_V5_사진포함백업_${today()}.json`);
      note("사진 파일이 포함된 복원용 백업을 저장했어요.");
    } catch { note("사진을 모두 가져오지 못해 사진 포함 백업을 중단했습니다. JSON 원장 백업을 먼저 저장해 주세요."); }
    finally { setPortableBusy(false); }
  };
  const exportAllExcel = async () => {
    const ExcelJS = await import("exceljs");
    const wb = new ExcelJS.Workbook();
    const inventory = wb.addWorksheet("재고·판매");
    inventory.columns = [
      ["상품코드", 18], ["상품명", 28], ["브랜드", 16], ["상태", 12], ["매입일", 13], ["매입가", 14],
      ["매입배송비", 14], ["수선비", 12], ["매입원가", 14], ["판매가", 14], ["순매출", 14], ["판매일", 13], ["수수료", 12], ["배송비", 12], ["환불액", 12], ["반품배송비", 12],
      ["순이익", 14], ["정산", 12], ["번장게시일", 13], ["번장URL", 38], ["증빙수", 10],
    ].map(([header, width]) => ({ header: String(header), key: String(header), width: Number(width) }));
    state.items.forEach(i => inventory.addRow({
      상품코드: i.id, 상품명: i.name, 브랜드: i.brand, 상태: i.inventoryStatus, 매입일: i.acquiredDate,
      매입가: i.purchasePrice, 매입배송비:i.buyShipping, 수선비:i.repairCost, 매입원가:totalCost(i), 판매가: i.actualPrice, 순매출:revenue(i), 판매일: i.saleDate, 수수료: i.fee, 배송비: i.shipping,
      환불액: i.refundAmount, 반품배송비: i.returnShipping, 순이익: i.actualPrice ? profit(i) : "",
      정산: i.settlementStatus, 번장게시일: i.listingPublishedDate, 번장URL: i.listingUrl, 증빙수: i.attachments.length,
    }));
    const debts = wb.addWorksheet("대출");
    debts.columns = ["대출명", "대출원금 잔액", "원금 상환액", "이자 비용", "다음 납부일", "납부 완료"].map(header => ({ header, key: header, width: 20 }));
    state.debts.forEach(d => debts.addRow({ 대출명: d.name, "대출원금 잔액": d.remaining, "원금 상환액": d.plannedPrincipal, "이자 비용": d.interestCost, "다음 납부일": d.nextPaymentDate, "납부 완료": d.paid ? "완료" : "대기" }));
    [inventory, debts].forEach(ws => { ws.getRow(1).font = { bold: true }; ws.views = [{ state: "frozen", ySplit: 1 }]; ws.autoFilter = { from: "A1", to: ws.getRow(1).getCell(ws.columnCount).address }; });
    const out = await wb.xlsx.writeBuffer();
    download(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `Deal_Hunter_전체데이터_${today().replaceAll("-", "")}.xlsx`);
    note("재고·판매·대출 전체 데이터를 엑셀로 내보냈어요.");
  };
  const parseLegacyHtmlBackup = (text: string) => {
    const marker = "window.__SELLER_OS_SEED__ =";
    const start = text.indexOf(marker);
    if (start < 0) throw new Error("legacy seed not found");
    let index = start + marker.length;
    while (/\s/.test(text[index] || "")) index++;
    if (text[index] !== "{") throw new Error("legacy seed malformed");
    let depth = 0, quoted = false, escaped = false, end = -1;
    for (let i = index; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') quoted = false;
        continue;
      }
      if (ch === '"') { quoted = true; continue; }
      if (ch === "{") depth++;
      if (ch === "}") { depth--; if (depth === 0) { end = i + 1; break; } }
    }
    if (end < 0) throw new Error("legacy seed incomplete");
    return JSON.parse(text.slice(index, end));
  };
  const importBackup = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const rawText = await file.text();
      const raw = file.name.toLowerCase().endsWith(".html") ? parseLegacyHtmlBackup(rawText) : JSON.parse(rawText);
      const source = raw.state || raw;
      if (!Array.isArray(source?.items)) throw new Error("items missing");
      const ids = source.items.map((x: any) => String(x?.id || "").trim()).filter(Boolean);
      const duplicates = ids.filter((id: string, idx: number) => ids.indexOf(id) !== idx);
      const next = migrate({...state,...source,settings:{...state.settings,...(source.settings||{})}});
      const active = next.items.filter(i => !["판매완료", "정산완료", "반품폐기", "보관함"].includes(i.inventoryStatus)).length;
      const sold = next.items.filter(i => ["판매완료", "정산완료"].includes(i.inventoryStatus)).length;
      const purchaseTotal = next.items.reduce((sum, i) => sum + totalCost(i), 0);
      if (duplicates.length || ids.length !== source.items.length) throw new Error("상품코드 중복 또는 누락");
      const warning = duplicates.length ? `\n중복 상품코드 ${new Set(duplicates).size}건이 감지됐습니다. 가져오기 전 원본 확인을 권장합니다.` : "";
      const ok = confirm(`${file.name}에서 ${next.items.length}개 상품을 확인했습니다.\n현재 사용중 ${active}개 / 판매완료 ${sold}개\n총 매입원가 ${won(purchaseTotal)}${warning}\n\n현재 상태를 JSON으로 자동 백업한 뒤 이 데이터로 교체할까요?`);
      if (!ok) return;
      exportBackup();
      if (next.items.some(item => [...item.attachments,...item.productPhotos].some(a => a.data?.startsWith("data:")))) {
        for (const item of next.items) for (const a of [...item.attachments,...item.productPhotos]) {
          if (!a.data?.startsWith("data:")) continue;
          const blob = await fetch(a.data).then(r => r.blob());
          const form = new FormData();form.append("file",new File([blob],a.name,{type:a.type||blob.type}));
          const response = await apiFetch("/api/files",{method:"POST",body:form});
          if (!response.ok) throw new Error("사진 복원 업로드 실패");
          const stored = await response.json();Object.assign(a,stored);delete a.data;
        }
      }
      const importedAt = new Date().toISOString();
      const safeNext = { ...next, audit: [...(next.audit || []), { at: importedAt, action: `${file.name}에서 기존 데이터 가져오기 (${next.items.length}개)` }] };
      setState(safeNext);
      note(file.name.toLowerCase().endsWith(".html") ? "v3 HTML 데이터를 추출해 v4 구조로 변환했어요." : "백업 데이터를 v4 구조로 복원했어요.");
    } catch (err) {
      console.error(err);
      note("올바른 Deal Hunter/Seller OS JSON 또는 v3 HTML 파일이 아니에요.");
    } finally { e.target.value = ""; }
  };
  const exportBunjang = async (ids?:string[]) => {
    const exportQueue = ids ? queue.filter(i=>ids.includes(i.id)) : queue;
    if (!exportQueue.length) return note("엑셀로 만들 상품이 없어요.");
    const invalid = exportQueue.filter(i => !queueChecks(i).every(Boolean));
    if (invalid.length) return note(`${invalid.length}개 상품의 제목·카테고리·설명·가격·이미지명을 확인해 주세요.`);
    try {
      const ExcelJS = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      const buffer = await fetch("/assets/bunjang-template.xlsx").then(r => r.arrayBuffer());
      await workbook.xlsx.load(buffer);
      const sheet = workbook.worksheets[0]; const source = sheet.getRow(5);
      exportQueue.forEach((item, idx) => {
        const row = sheet.getRow(6 + idx);
        for (let c = 1; c <= 36; c++) {
          const a = source.getCell(c), b = row.getCell(c);
          b.style = JSON.parse(JSON.stringify(a.style || {})); b.numFmt = a.numFmt;
        }
        const l = item.listing;
        const values: any[] = [l.title, Number(l.categoryId), null, l.apparelSize || null, l.bottomSize || null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, Number(l.condition), l.description, Number(l.price), l.shippingType, l.shippingType === "별도" ? Number(l.shippingFee) : null, l.convenience, Number(l.halfShipping) || null, l.directDeal, l.directDeal === "가능" ? Number(l.regionId) || null : null, l.directDeal === "가능" ? l.meetingPlace : null, l.tags.map(t => `#${t.replace(/^#/, "")}`).join(" "), listingPhotoNames(item.id,actualListingPhotos(item.productPhotos)).join(", "), l.quantity || 1, null];
        values.forEach((v, c) => row.getCell(c + 1).value = v); row.height = source.height || 72;
      });
      const out = await workbook.xlsx.writeBuffer();
      download(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `번개장터_의류_일괄등록_${today().replaceAll("-", "")}_${exportQueue.length}건.xlsx`);
      const exportedIds = new Set(exportQueue.map(i => i.id));
      update(s => ({ ...s, items: s.items.map(i => exportedIds.has(i.id) ? { ...i, listingStatus: "엑셀생성" } : i) }), `번개장터 일괄등록 엑셀 ${exportQueue.length}건 생성`);
      note("번개장터 공식 양식 엑셀을 생성했어요.");
    } catch (err) { console.error(err); note("엑셀 생성 중 문제가 생겼어요."); }
  };

  const exportQueuePhotos = async () => {
    const candidates=queue.filter(i=>queueChecks(i).every(Boolean));
    if(!candidates.length) return note("검수가 끝난 상품 사진이 없습니다.");
    try {
      const JSZip=(await import("jszip")).default,zip=new JSZip(),names=new Set<string>();
      for(const item of candidates){
        const photos=actualListingPhotos(item.productPhotos),photoNames=listingPhotoNames(item.id,photos);
        for(let index=0;index<photos.length;index++){
          const attachment=photos[index],name=photoNames[index];
          if(names.has(name))throw new Error("사진 파일명 중복");names.add(name);
          let url=attachment.data||attachment.url;
          if(attachment.key){const response=await apiFetch(`/api/files?key=${encodeURIComponent(attachment.key)}`);if(!response.ok)throw new Error("사진 조회 실패");url=(await response.json()).url;}
          if(!url)throw new Error("사진 주소 없음");const response=await fetch(url);if(!response.ok)throw new Error("사진 다운로드 실패");zip.file(name,await response.arrayBuffer());
        }
      }
      download(await zip.generateAsync({type:"blob"}),`번개장터_등록사진_${today()}_${candidates.length}건.zip`);note("엑셀 사진명과 일치하는 실제 상품사진 ZIP을 저장했어요.");
    }catch{note("사진 ZIP을 완성하지 못했습니다. 실제 사진 연결을 확인해 주세요.");}
  };
  const queueChecks = (item: Item) => { const photos=actualListingPhotos(item.productPhotos); return [item.listing.title, /^\d+$/.test(item.listing.categoryId), item.listing.description, item.listing.price > 0, photos.length > 0 && photos.every(p => ["image/jpeg","image/png","image/webp","image/gif"].includes(p.type) && (p.key || p.url || p.data))]; };
  const importExcel = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const ExcelJS = await import("exceljs"); const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await file.arrayBuffer());
      const ws = wb.getWorksheet("재고·판매") || wb.getWorksheet("재고") || wb.worksheets[0]; const headers = new Map<string, number>();
      ws.getRow(1).eachCell((c, n) => headers.set(String(c.value || "").trim(), n));
      const col = (names: string[]) => names.map(n => headers.get(n)).find(Boolean);
      if (!col(["상품코드"]) || !col(["상품명"])) throw new Error("필수 헤더 없음");
      const rows: Partial<Item>[] = [];
      for (let r = 2; r <= ws.rowCount; r++) {
        const get = (names: string[]) => { const c = col(names); return c ? ws.getRow(r).getCell(c).value ?? "" : ""; };
        const id = String(get(["상품코드"])).trim(); if (!id) continue;
        const n = (names: string[]) => { const value = get(names); if(value === "" || value === null) return undefined; const parsed=Number(String(typeof value === "object" && value && "result" in value ? value.result : value).replaceAll(",","")); if(!Number.isFinite(parsed)||parsed<0) throw new Error("잘못된 금액 셀"); return parsed; };
        const d = (names: string[]) => { const value = get(names); if (!value) return ""; if (value instanceof Date) return value.toISOString().slice(0, 10); const parsed = new Date(String(value)); return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10); };
        rows.push({
          id, name: String(get(["상품명"])).trim(), brand: String(get(["브랜드"])).trim(),
          acquiredDate: d(["입고일", "매입일"]), inventoryStatus: String(get(["재고상태", "상품상태", "상태"]) || "").trim(),
          purchaseSource: String(get(["위치", "매입처"]) || "").trim(), purchasePrice: n(["구매가", "매입가"]), buyShipping:n(["매입배송비"]), repairCost:n(["수선비"]),
          retailPrice: n(["정가"]), expectedPrice: n(["예상판매가"]), actualPrice: n(["실판매가", "판매가"]),
          fee: n(["수수료"]), shipping: n(["택배비", "배송비"]), refundAmount:n(["환불액"]), returnShipping:n(["반품배송비"]), saleDate: d(["판매일"]),
          saleChannel: String(get(["채널", "판매채널"]) || "").trim(), size: String(get(["사이즈"]) || "").trim(),
          color: String(get(["색상"]) || "").trim(), notes: String(get(["비고"]) || "").trim(),
        });
      }
      if(new Set(rows.map(i=>i.id)).size !== rows.length) throw new Error("중복 상품코드");
      const existing = new Map(state.items.map(i => [i.id, i])); let changed = 0, added = 0;
      const merged = [...state.items];
      rows.forEach(part => {
        const old = existing.get(part.id!);
        if (old) {
          const safe = { ...old, ...Object.fromEntries(Object.entries(part).filter(([, v]) => v !== "" && v !== undefined && v !== null)) };
          safe.dataIssues = qualityIssues(safe);
          const idx = merged.findIndex(i => i.id === part.id); merged[idx] = safe; changed++;
        } else { const created = { ...blankItem(), acquiredDate:"", ...Object.fromEntries(Object.entries(part).filter(([,v])=>v!==undefined&&v!==null)) } as Item; created.dataIssues = qualityIssues(created); merged.unshift(created); added++; }
      });
      validateState({...state,items:merged});
      if (!confirm(`가져오기 미리보기\n신규 ${added}건 · 기존 업데이트 ${changed}건\n\n빈 셀은 기존 판매정보를 덮어쓰지 않습니다. 반영할까요?`)) return;
      exportBackup();
      update(s => ({ ...s, items: merged }), `재고 엑셀 신규 ${added}건·업데이트 ${changed}건`);
      note("판매정보를 보존하면서 엑셀을 반영했어요.");
    } catch { note("재고 엑셀의 상품코드·상품명 헤더를 확인해 주세요."); }
    e.target.value = "";
  };
  const importMarketCsv = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const parsed = parseCsv(await file.text());
      if (parsed.length < 2) throw new Error("empty");
      const headers = parsed[0].map(x => x.trim().toLowerCase());
      const index = (...names: string[]) => names.map(n => headers.indexOf(n)).find(n => n >= 0) ?? -1;
      const ix = {
        id: index("listing_id", "product_id", "id", "상품id", "상품번호"),
        title: index("title", "name", "product_name", "상품명", "제목"),
        brand: index("brand", "브랜드"),
        model: index("model", "model_name", "모델", "모델명"),
        category: index("category", "카테고리"),
        size: index("size", "사이즈"),
        color: index("color", "컬러", "색상"),
        price: index("price", "판매가", "가격"),
        url: index("url", "상품url", "링크"),
        image: index("image_url", "image", "이미지"),
        first: index("first_seen_at", "first_seen", "최초수집일"),
        last: index("last_seen_at", "last_seen", "최근수집일"),
        active: index("is_active", "active", "판매중"),
        sold: index("sold_confirmed", "is_sold", "판매확인", "판매완료확인"),
        endedReason: index("ended_reason", "inactive_reason", "종료사유"),
      };
      if (ix.id < 0 || ix.title < 0 || ix.price < 0) throw new Error("headers");
      const listings: MarketListing[] = parsed.slice(1).map((row, n) => {
        const read = (i: number) => i >= 0 ? String(row[i] || "").trim() : "";
        const title = read(ix.title); const id = read(ix.id);
        const activeText = read(ix.active).toLowerCase();
        const soldText = read(ix.sold).toLowerCase();
        const soldConfirmed = ["1", "true", "y", "yes", "판매", "판매완료"].includes(soldText);
        const active = ix.active >= 0 ? !["0", "false", "n", "종료", "판매완료", "삭제"].includes(activeText) : true;
        return {
          id: id || `CSV-${n + 1}`, title,
          brand: read(ix.brand) || buy.brand || title.split(" ")[0] || "브랜드 미입력",
          model: read(ix.model) || normalize(title).split(" ").slice(1, 5).join(" "),
          category: read(ix.category) || "의류", size: read(ix.size), color: read(ix.color),
          price: Number(read(ix.price).replace(/[^0-9.-]/g, "")) || 0,
          url: read(ix.url), imageUrl: read(ix.image), firstSeen: read(ix.first) || today(),
          lastSeen: read(ix.last) || today(), active,
          soldConfirmed, endedReason: read(ix.endedReason) || (!active ? soldConfirmed ? "판매 확인" : "비활성·사유 미확인" : ""),
        };
      }).filter(x => x.id && x.title && x.price > 0);
      const existing = new Map(state.marketListings.map(x => [x.id, x]));
      const incomingIds = new Set(listings.map(x => x.id));
      if (ix.active < 0) {
        existing.forEach((value, id) => {
          if (value.active && !incomingIds.has(id)) existing.set(id, { ...value, active: false, endedReason: "이번 전체 CSV에서 미확인 · 판매 여부 미확인" });
        });
      }
      listings.forEach(x => {
        const previous = existing.get(x.id);
        existing.set(x.id, { ...(previous || x), ...x, firstSeen: previous?.firstSeen || x.firstSeen });
      });
      update(s => ({ ...s, marketListings: [...existing.values()] }), `번개장터 시세 CSV ${listings.length}건 반영`);
      note(`${listings.length}건 반영 · 비활성은 판매완료로 단정하지 않아요.`);
    } catch {
      note("CSV의 listing_id·title·price 열을 확인해 주세요.");
    }
    e.target.value = "";
  };

  const renderHome = () => (
    <>
      <div className="simple-head">
        <div><p className="eyebrow">오늘의 운영 현황</p><h1>리셀 현황을 한눈에</h1><p>매입부터 판매와 정산까지, 지금 필요한 일만 확인하세요.</p></div>
        <button className="primary big" onClick={() => setPurchaseEditing(blankItem())}>+ 매입 등록</button>
      </div>
      <div className="quick-actions">
        <button onClick={() => setPurchaseEditing(blankItem())}><i>＋</i><span><b>매입 등록</b><small>증빙을 저장하면 재고 자동 생성</small></span><em>›</em></button>
        <button onClick={() => setView("queue")}><i>↗</i><span><b>번장 등록대기</b><small>{queue.length}개 상품 확인</small></span><em>›</em></button>
        <button onClick={() => { setInventoryFilter("판매중"); setView("inventory"); }}><i>✓</i><span><b>판매완료 처리</b><small>판매가와 정산 기록</small></span><em>›</em></button>
      </div>
      <div className="summary-strip">
        <button onClick={() => setView("analytics")}><span>이번 달 매출</span><strong>{won(monthly.find(([m])=>m===currentMonth)?.[1].revenue || 0)}</strong><small>{monthSold.length}건 판매</small></button>
        <button onClick={() => setView("analytics")}><span>이번 달 순이익</span><strong>{won(monthProfit)}</strong><small>수수료·배송비 반영</small></button>
        <button onClick={() => setView("money")}><span>정산 예정액</span><strong>{won(settlement)}</strong><small>아직 받지 못한 금액</small></button>
        <button onClick={() => setView("money")}><span>대출 잔액</span><strong>{won(state.debts.reduce((s, d) => s + d.remaining, 0))}</strong><small>다음 납부 {won(upcomingDebt)}</small></button>
      </div>
      <section className="card home-inventory">
        <SectionTitle title={`현재 재고 ${active.length}개`} action="전체 재고 보기" onClick={() => { setInventoryFilter("전체"); setView("inventory"); }} />
        <div className="home-list">
          {recentItems.filter(i => active.some(a => a.id === i.id)).slice(0, 5).map(i => <button key={i.id} onClick={() => setEditing({ ...makeDraft(i)})}><span className="product-dot">{i.brand.slice(0, 1) || "?"}</span><span><b>{i.brand} {i.name}</b><small>{i.size || "사이즈 미입력"} · {i.acquiredDate ? `${days(i.acquiredDate)}일 보유` : "입고일 확인"}</small></span><strong>{won(i.expectedPrice || totalCost(i))}</strong><em>›</em></button>)}
        </div>
      </section>
    </>
  );

  const renderInventory = () => {
    const shops = [...new Set(state.items.flatMap(i => marketplaceLinks(i).map(link => link.shop)).filter(Boolean))].sort((a,b) => a.localeCompare(b, "ko"));
    const rows = state.items.filter(i => `${i.brand} ${i.name} ${i.model} ${i.id}`.toLowerCase().includes(search.toLowerCase()))
      .filter(i => registrationFilter === "전체" || registrationState(i) === registrationFilter)
      .filter(i => registrationShop === "전체" || marketplaceLinks(i).some(link => link.shop === registrationShop))
      .filter(i =>
        inventoryFilter === "전체" && !i.archivedAt ||
        inventoryFilter === "확인 필요" && qualityIssues(i).length > 0 && !i.archivedAt ||
        inventoryFilter === "증빙없음" && !i.attachments.length && !i.archivedAt ||
        inventoryFilter === "보관함" && Boolean(i.archivedAt) ||
        inventoryFilter === i.inventoryStatus && !i.archivedAt
      )
      .filter(i =>
        (inventoryOptions.category === "전체" || i.category === inventoryOptions.category) &&
        (inventoryOptions.condition === "전체" || i.condition === inventoryOptions.condition) &&
        (inventoryOptions.payment === "전체" || i.purchasePayment === inventoryOptions.payment) &&
        (inventoryOptions.listing === "전체" || i.listingStatus === inventoryOptions.listing) &&
        (inventoryOptions.evidence === "전체" || (inventoryOptions.evidence === "있음" ? i.attachments.length > 0 : i.attachments.length === 0)) &&
        (!inventoryOptions.dateFrom || i.acquiredDate >= inventoryOptions.dateFrom) &&
        (!inventoryOptions.dateTo || i.acquiredDate <= inventoryOptions.dateTo)
      )
      .sort((a, b) => {
        const dateCmp = (left: string, right: string, desc = false) => {
          if (!left && !right) return 0;
          if (!left) return 1;
          if (!right) return -1;
          return desc ? right.localeCompare(left) : left.localeCompare(right);
        };
        const numCmp = (left: number, right: number, desc = false) => desc ? right - left : left - right;
        const textCmp = (left: string, right: string, desc = false) => desc ? right.localeCompare(left, "ko") : left.localeCompare(right, "ko");
        const hold = (item: Item) => item.acquiredDate ? days(item.acquiredDate, item.inventoryStatus === "판매완료" ? item.saleDate || undefined : undefined) : -1;
        const actualMargin = (item: Item) => profit(item);
        switch (inventorySort) {
          case "입고일 오래된순": return dateCmp(a.acquiredDate, b.acquiredDate);
          case "매입가 높은순": return numCmp(totalCost(a), totalCost(b), true);
          case "매입가 낮은순": return numCmp(totalCost(a), totalCost(b));
          case "예상판매가 높은순": return numCmp(a.expectedPrice, b.expectedPrice, true);
          case "예상판매가 낮은순": return numCmp(a.expectedPrice, b.expectedPrice);
          case "상품명 가나다순": return textCmp(a.name, b.name);
          case "상품명 역순": return textCmp(a.name, b.name, true);
          case "브랜드 가나다순": return textCmp(a.brand, b.brand);
          case "브랜드 역순": return textCmp(a.brand, b.brand, true);
          case "보유기간 긴순": return numCmp(hold(a), hold(b), true);
          case "보유기간 짧은순": return numCmp(hold(a), hold(b));
          case "판매완료일 최신순": return dateCmp(a.saleDate, b.saleDate, true);
          case "판매완료일 오래된순": return dateCmp(a.saleDate, b.saleDate);
          case "실판매가 높은순": return numCmp(a.actualPrice, b.actualPrice, true);
          case "실판매가 낮은순": return numCmp(a.actualPrice, b.actualPrice);
          case "실마진 높은순": return numCmp(actualMargin(a), actualMargin(b), true);
          case "실마진 낮은순": return numCmp(actualMargin(a), actualMargin(b));
          case "입고일 최신순":
          default: return dateCmp(a.acquiredDate, b.acquiredDate, true);
        }
      });
    const activeOptionCount = Object.entries(inventoryOptions).filter(([, value]) => value && value !== "전체").length;
    const photoFor = productPhotoFor;
    const resetOptions = () => { setRegistrationFilter("전체"); setRegistrationShop("전체"); setInventoryOptions({ category: "전체", condition: "전체", payment: "전체", listing: "전체", evidence: "전체", dateFrom: "", dateTo: "" }); };
    return <section className="card main-card">
      <div className="toolbar inventory-heading"><div><p className="eyebrow">전체 상품 {state.items.length}건</p><h2>재고관리</h2><p className="muted">사진으로 상품을 빠르게 찾고, 카드를 눌러 바로 수정하세요.</p></div><button className="primary" onClick={() => setPurchaseEditing(blankItem())}>+ 매입 등록</button></div>
      <div className="pill-filters">{["전체", "등록대기", "판매중", "예약중", "판매완료", "증빙없음", "확인 필요", "보관함"].map(f => <button key={f} className={inventoryFilter === f ? "active" : ""} onClick={() => { setInventoryFilter(f); if (f !== "판매완료" && ["판매완료일 최신순", "판매완료일 오래된순", "실판매가 높은순", "실판매가 낮은순", "실마진 높은순", "실마진 낮은순"].includes(inventorySort)) setInventorySort("입고일 최신순"); }}>{f}{f === "판매완료" ? ` ${sold.length}` : f === "확인 필요" ? ` ${reviewItems.length}` : ""}</button>)}</div>
      <div className="inventory-searchbar">
        <label><span aria-hidden="true">⌕</span><input placeholder="상품명·브랜드·상품코드로 검색" value={search} onChange={e => setSearch(e.target.value)} /></label>
        <button className={inventoryOptionsOpen || activeOptionCount ? "active" : ""} onClick={() => setInventoryOptionsOpen(v => !v)} aria-expanded={inventoryOptionsOpen}><span aria-hidden="true">☷</span> 옵션{activeOptionCount > 0 && <b>{activeOptionCount}</b>}</button>
      </div>
      <div className="inventory-view-sort">
        <div className="inventory-view-toggle" aria-label="재고 보기 방식">
          <button className={inventoryViewMode === "image" ? "active" : ""} onClick={() => setInventoryViewMode("image")}>▦ 이미지로 보기</button>
          <button className={inventoryViewMode === "text" ? "active" : ""} onClick={() => setInventoryViewMode("text")}>☷ 텍스트로만 보기</button>
        </div>
        <label className="inventory-sort-select"><span>정렬</span><select value={inventorySort} onChange={e => setInventorySort(e.target.value)}>
          {["입고일 최신순", "입고일 오래된순", "매입가 높은순", "매입가 낮은순", "예상판매가 높은순", "예상판매가 낮은순", "상품명 가나다순", "상품명 역순", "브랜드 가나다순", "브랜드 역순", "보유기간 긴순", "보유기간 짧은순", ...(inventoryFilter === "판매완료" ? ["판매완료일 최신순", "판매완료일 오래된순", "실판매가 높은순", "실판매가 낮은순", "실마진 높은순", "실마진 낮은순"] : [])].map(o => <option key={o} value={o}>{o}</option>)}
        </select></label>
      </div>
      <div className="inventory-registration-filters">
        <div className="registration-filter-pills" aria-label="번개장터 등록 필터"><span>번개장터</span>{["전체", "등록완료", "미등록", "확인 필요"].map(value => <button key={value} className={registrationFilter === value ? "active" : ""} aria-pressed={registrationFilter === value} onClick={() => setRegistrationFilter(value)}>{value}</button>)}</div>
        <label className="registration-shop-select"><span>상점</span><select aria-label="번개장터 상점" value={registrationShop} onChange={e => setRegistrationShop(e.target.value)}><option value="전체">전체 상점</option>{shops.map(shop => <option key={shop}>{shop}</option>)}</select></label>
      </div>
      {inventoryOptionsOpen && <div className="inventory-options">
        <div className="option-grid">
          <Select label="카테고리" value={inventoryOptions.category} options={["전체", "아우터", "상의", "하의", "신발", "가방", "액세서리", "기타 의류"]} onChange={v => setInventoryOptions({ ...inventoryOptions, category: v })} />
          <Select label="상품상태" value={inventoryOptions.condition} options={["전체", "S", "A", "B", "C"]} onChange={v => setInventoryOptions({ ...inventoryOptions, condition: v })} />
          <Select label="결제수단" value={inventoryOptions.payment} options={["전체", "계좌이체", "카드", "현금", "간편결제", "기타"]} onChange={v => setInventoryOptions({ ...inventoryOptions, payment: v })} />
          <Select label="번장상태" value={inventoryOptions.listing} options={["전체", "미등록", "등록대기", "등록완료"]} onChange={v => setInventoryOptions({ ...inventoryOptions, listing: v })} />
          <Select label="매입증빙" value={inventoryOptions.evidence} options={["전체", "있음", "없음"]} onChange={v => setInventoryOptions({ ...inventoryOptions, evidence: v })} />
        </div>
        <div className="date-option"><span>입고기간</span><input type="date" value={inventoryOptions.dateFrom} onChange={e => setInventoryOptions({ ...inventoryOptions, dateFrom: e.target.value })} /><i>–</i><input type="date" value={inventoryOptions.dateTo} onChange={e => setInventoryOptions({ ...inventoryOptions, dateTo: e.target.value })} /><button onClick={resetOptions}>옵션 초기화</button></div>
      </div>}
      <input ref={excelRef} hidden type="file" accept=".xlsx,.xls" onChange={importExcel} />
      <div className="inventory-summary"><span>검색 결과 <b>{rows.length}개</b></span><span>현재 재고 원가 <b>{won(inventoryCost)}</b></span><span>등록대기 <b>{queue.length}개</b></span><button onClick={() => excelRef.current?.click()}>엑셀 가져오기</button></div>
      {inventoryViewMode === "image" ? <div className="inventory-card-list">
        {rows.map(i => { const issues = qualityIssues(i); const completed = i.inventoryStatus === "판매완료"; const photo = photoFor(i); return <article key={i.id} className={`inventory-product-card ${issues.length ? "needs-review" : ""}`} onClick={() => setEditing({ ...makeDraft(i)})}>
          <div className="inventory-card-body">
            <div className={`inventory-photo ${completed ? "is-sold" : ""}`}>{photo ? <img src={photo} alt={`${i.brand} ${i.name}`} loading="lazy" /> : <span>{i.brand.slice(0, 1) || "?"}<small>사진 없음</small></span>}{completed && <div className="inventory-sale-overlay"><span>판매완료</span></div>}</div>
            <div className="inventory-card-info">
              <strong>{completed ? (i.actualPrice > 0 ? won(revenue(i)) : "판매가 확인 필요") : i.expectedPrice > 0 ? won(i.expectedPrice) : "판매가 미입력"}</strong>
              <h3>{i.brand} {i.name}</h3>
              <p>{i.size || "사이즈 미입력"} · {i.condition}급 · {i.id}</p>
              <div className="inventory-card-meta"><span>매입 {won(totalCost(i))}</span><span>{i.acquiredDate ? `${days(i.acquiredDate, completed ? i.saleDate || undefined : undefined)}일 보유` : "보유기간 확인"}</span><span>{i.acquiredDate || "입고일 미입력"} 입고</span><Badge text={i.inventoryStatus} />{completed && <span>판매일 {i.saleDate || "확인 필요"}</span>}</div>
              <MarketplaceRegistration item={i} />
              <div className="inventory-card-flags">{i.productPhotos?.some(p=>p.kind==='reference') && !actualListingPhotos(i.productPhotos).length && <span>제품 참고사진</span>}{!i.attachments.length && <span>증빙없음</span>}{issues.length > 0 && <span>확인 필요</span>}</div>
            </div>
            <div className="inventory-card-actions" onClick={e => e.stopPropagation()}>
              <details className="row-more"><summary aria-label="추가 메뉴">•••</summary><div><button onClick={() => setPurchaseEditing({ ...makeDraft(i)})}>매입정보·증빙</button><button onClick={() => setEditing({ ...makeDraft(i)})}>상품정보 수정</button><button onClick={() => copyItem(i)}>상품 복사</button>{i.archivedAt ? <button onClick={() => restoreItem(i)}>보관함에서 복원</button> : <button onClick={() => archiveItem(i)}>보관함으로 이동</button>}</div></details>
              {completed ? <button className="sale-view" onClick={() => setSaleEditing({ ...makeDraft(i)})}>판매정보</button> : !i.archivedAt && <button className="sale-action" onClick={() => setSaleEditing(makeSaleDraft(i))}>판매완료</button>}
            </div>
          </div>
        </article>})}
        {!rows.length && <div className="inventory-empty"><b>조건에 맞는 상품이 없어요.</b><span>검색어나 옵션을 초기화해 보세요.</span><button onClick={() => { setSearch(""); setInventoryFilter("전체"); resetOptions(); }}>전체 상품 보기</button></div>}
      </div> : <div className="inventory-text-wrap">
        <table className="inventory-text-table">
          <thead><tr><th>입고일</th>{inventoryFilter === "판매완료" && <th>판매완료일</th>}<th>상품</th><th>상품코드</th><th>사이즈</th><th>매입가</th><th>{inventoryFilter === "판매완료" ? "실판매가" : "예상판매가"}</th>{inventoryFilter === "판매완료" && <th>실마진</th>}<th>보유기간</th><th>상태</th><th>번개장터 등록</th><th></th></tr></thead>
          <tbody>{rows.map(i => { const completed = i.inventoryStatus === "판매완료"; const margin = profit(i); return <tr key={i.id} onClick={() => setEditing({ ...makeDraft(i)})}>
            <td>{i.acquiredDate || "-"}</td>{inventoryFilter === "판매완료" && <td>{i.saleDate || "확인 필요"}</td>}<td className="product-cell"><b>{i.brand}</b><span>{i.name}</span></td><td className="code-cell">{i.id}</td><td>{i.size || "-"}</td><td>{won(totalCost(i))}</td><td className="money-strong">{completed ? (i.actualPrice > 0 ? won(i.actualPrice) : "확인 필요") : (i.expectedPrice > 0 ? won(i.expectedPrice) : "미입력")}</td>{inventoryFilter === "판매완료" && <td className={margin < 0 ? "money-loss" : "money-profit"}>{i.actualPrice > 0 && totalCost(i)>0 ? won(margin) : "확인 필요"}</td>}<td>{i.acquiredDate ? `${days(i.acquiredDate, i.inventoryStatus === "판매완료" ? i.saleDate || undefined : undefined)}일` : "-"}</td><td><Badge text={i.inventoryStatus} /></td><td><MarketplaceRegistration item={i} /></td><td onClick={e => e.stopPropagation()}><button className="text-row-more" onClick={() => completed ? setSaleEditing({ ...makeDraft(i)}) : setEditing({ ...makeDraft(i)})}>보기</button></td>
          </tr>})}</tbody>
        </table>
        {!rows.length && <div className="inventory-empty"><b>조건에 맞는 상품이 없어요.</b><span>검색어나 옵션을 초기화해 보세요.</span><button onClick={() => { setSearch(""); setInventoryFilter("전체"); resetOptions(); }}>전체 상품 보기</button></div>}
      </div>}
    </section>;
  };

  const renderEvidence = () => {
    const itemsWithEvidence = state.items.filter(i => i.attachments.length > 0 && !i.archivedAt);
    const missingEvidence = state.items.filter(i => i.attachments.length === 0 && !i.archivedAt);
    const evidenceFiles = itemsWithEvidence.reduce((sum, i) => sum + i.attachments.length, 0);
    const rows = state.items
      .filter(i => !i.archivedAt)
      .filter(i => `${i.brand} ${i.name} ${i.id} ${i.purchaseSource}`.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => (b.acquiredDate || "").localeCompare(a.acquiredDate || ""));
    return <>
      <div className="toolbar evidence-heading">
        <div><p className="eyebrow">매입 기록</p><h2>증빙</h2><p className="muted">영수증·이체내역·거래 캡처를 상품별로 모아 확인하세요.</p></div>
        <button className="primary" onClick={() => setPurchaseEditing(blankItem())}>+ 매입 등록</button>
      </div>
      <div className="evidence-kpis">
        <div><span>증빙 있는 상품</span><strong>{itemsWithEvidence.length}개</strong></div>
        <div><span>보관 중인 파일</span><strong>{evidenceFiles}개</strong></div>
        <button onClick={() => { setInventoryFilter("증빙없음"); setView("inventory"); }}><span>증빙 미첨부</span><strong>{missingEvidence.length}개</strong><small>재고에서 확인하기 →</small></button>
      </div>
      <section className="card evidence-hub-card">
        <div className="evidence-toolbar"><label><span aria-hidden="true">⌕</span><input placeholder="상품명·브랜드·상품코드·매입처 검색" value={search} onChange={e => setSearch(e.target.value)} /></label><span>전체 {rows.length}개 상품</span></div>
        <div className="evidence-rows">
          {rows.map(i => <article key={i.id} className={!i.attachments.length ? "missing" : ""}>
            <div className="evidence-item">
              <span className="evidence-thumb">{i.productPhotos?.[0]?.url || i.productPhotos?.[0]?.data || i.photoUrl ? <img src={i.productPhotos?.[0]?.url || i.productPhotos?.[0]?.data || i.photoUrl} alt="" /> : (i.brand.slice(0, 1) || "?")}</span>
              <span><b>{i.brand} {i.name}</b><small>{i.id} · {i.acquiredDate || "매입일 미입력"} · {i.purchaseSource || "매입처 미입력"}</small></span>
            </div>
            <div className="evidence-files">
              {i.attachments.length ? i.attachments.map((a, index) => <a key={`${a.name}-${index}`} href={a.url || a.data} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>{a.name}</a>) : <span>첨부된 증빙이 없어요.</span>}
            </div>
            <button onClick={() => setPurchaseEditing({ ...makeDraft(i)})}>{i.attachments.length ? "증빙 관리" : "증빙 추가"}</button>
          </article>)}
          {!rows.length && <div className="inventory-empty"><b>검색 결과가 없어요.</b><span>다른 상품명이나 상품코드로 검색해 보세요.</span></div>}
        </div>
      </section>
    </>;
  };

  const renderProducts = () => (
    <>
      <div className="queue-hero">
        <div><p className="eyebrow">DEAL HUNTER PRODUCT LIBRARY</p><h2>상품 라이브러리</h2><p>원본 v3.1처럼 번개 시세 매물을 상품·모델·사이즈 단위로 묶어 중앙가와 판매 종료 흐름을 봅니다.</p></div>
        <button className="primary big" onClick={() => marketCsvRef.current?.click()}>번장 CSV 가져오기</button>
      </div>
      <section className="card">
        <div className="toolbar"><div><p className="eyebrow">NORMALIZED PRODUCTS</p><h2>통합 상품 {marketProducts.length}개</h2></div><div className="toolbar-actions"><input className="search" placeholder="브랜드·모델 검색" value={search} onChange={e => setSearch(e.target.value)} /><button className="secondary" onClick={() => setView("market")}>시세 데이터 관리</button></div></div>
        <div className="table-wrap"><table><thead><tr><th>상품</th><th>사이즈·색상</th><th>전체 표본</th><th>최근 활성</th><th>판매 확인</th><th>활성 중앙가</th><th>최저 활성가</th><th></th></tr></thead><tbody>
          {marketProducts.filter(p => `${p.brand} ${p.model} ${p.size}`.toLowerCase().includes(search.toLowerCase())).map(p => <tr key={p.key}><td><b>{p.brand} {p.model}</b><small>{p.category || "의류"}</small></td><td>{p.size} · {p.color || "-"}</td><td>{p.listings.length}건</td><td>{p.freshCount}건</td><td>{p.soldConfirmed}건</td><td><strong>{p.median ? won(p.median) : "표본 없음"}</strong></td><td>{p.low ? won(p.low) : "-"}</td><td><button className="text-button" disabled={!p.median} onClick={() => { setBuy({ ...buy, brand: p.brand, name: p.model, size: p.size === "-" ? "" : p.size, market: p.median, offer: p.low, evidence: p.freshCount + p.soldConfirmed }); setView("buy"); }}>판단</button></td></tr>)}
          {!marketProducts.length && <tr><td colSpan={8}><p className="empty">번개장터 products.csv를 가져오면 상품별로 자동 정리됩니다.</p></td></tr>}
        </tbody></table></div>
      </section>
    </>
  );

  const renderBuy = () => (
    <>
    <div className="buy-layout">
      <section className="card form-card"><p className="eyebrow">BUY DECISION</p><h2>매입 전 판단 카드</h2><p className="muted">최근 시세, 보유기간, 목표수익과 현재 현금 여력을 함께 반영합니다.</p>
        {saleComparables.length > 0 && <div className="evidence-card"><div><span>내 실제 판매 {saleComparables.length}건</span><strong>체결가 중앙값 {won(actualSaleMedian)}</strong><small>평균 판매 {actualAvgDays}일 · 등록 희망가보다 높은 신뢰도</small></div><button className="secondary" onClick={() => setBuy({ ...buy, market: actualSaleMedian, evidence: Math.max(buy.evidence, saleComparables.length) })}>예상 판매가에 적용</button></div>}
        <div className="form-grid">
          <Field label="브랜드" value={buy.brand} onChange={v => setBuy({ ...buy, brand: v })} />
          <Field label="상품명·모델" value={buy.name} onChange={v => setBuy({ ...buy, name: v })} />
          <Field label="사이즈" value={buy.size} onChange={v => setBuy({ ...buy, size: v })} />
          <Select label="매입처" value={buy.source} options={["번개장터", "당근", "후르츠", "패밀리", "KREAM"]} onChange={v => setBuy({ ...buy, source: v })} />
          <Select label="시즌" value={buy.season} options={["겨울", "여름", "간절기", "사계절"]} onChange={v => setBuy({ ...buy, season: v })} />
          <Field label="비교 거래·매물 수" value={buy.evidence} type="number" onChange={v => setBuy({ ...buy, evidence: Number(v) })} />
          <Field label="보수적 예상 판매가" value={buy.market} type="number" suffix="원" onChange={v => setBuy({ ...buy, market: Number(v) })} />
          <Field label="현재 제안가" value={buy.offer} type="number" suffix="원" onChange={v => setBuy({ ...buy, offer: Number(v) })} />
          <Field label="매입 배송비" value={buy.shipping} type="number" suffix="원" onChange={v => setBuy({ ...buy, shipping: Number(v) })} />
          <Field label="수선·세탁 예상" value={buy.repair} type="number" suffix="원" onChange={v => setBuy({ ...buy, repair: Number(v) })} />
          <Field label="예상 보유기간" value={buy.holdMonths} type="number" suffix="개월" onChange={v => setBuy({ ...buy, holdMonths: Number(v) })} />
        </div>
      </section>
      <section className={`decision-card ${buy.offer <= maxBuy && buyScore >= 70 ? "go" : buy.offer <= maxBuy ? "conditional" : "stop"}`}>
        <div className="score-ring"><b>{buyScore}</b><span>점</span></div>
        <p className="eyebrow">판정 결과</p><h2>{buy.offer <= maxBuy && buyScore >= 70 ? "매입 가능" : buy.offer <= maxBuy ? "조건부 매입" : "가격 조정 또는 패스"}</h2>
        <div className="max-price"><span>최대 매입가</span><strong>{won(maxBuy)}</strong></div>
        <div className="decision-metrics"><div><span>예상 순익</span><b>{won(expectedProfit)}</b></div><div><span>예상 ROI</span><b>{buy.offer ? `${(expectedProfit / buy.offer * 100).toFixed(1)}%` : "-"}</b></div><div><span>매입 후 여력</span><b>{won(buyable - buy.offer)}</b></div><div><span>자금비용</span><b>{won(holdCost)}</b></div></div>
        <div className="reason"><b>판단 근거</b><p>{buy.evidence < 3 ? "시세 표본이 적습니다. " : ""}{buy.offer > maxBuy ? `현재 제안가는 기준보다 ${won(buy.offer - maxBuy)} 높습니다.` : `목표 순익 ${won(state.settings.targetProfit)}과 ROI ${state.settings.targetRoi}%를 충족합니다.`}</p></div>
        <button className="dark-button" onClick={() => {
          const item = { ...blankItem(), brand: buy.brand, name: buy.name, size: buy.size, season: buy.season, purchaseSource: buy.source, purchasePrice: buy.offer, buyShipping: buy.shipping, repairCost: buy.repair, expectedPrice: buy.market, minimumPrice: Math.max(0, Math.round((buy.offer + buy.shipping + buy.repair + state.settings.defaultShipping) / (1 - state.settings.feeRate) / 1000) * 1000) };
          setEditing(item); note("판단 결과를 상품 등록으로 넘겼어요.");
        }}>이 조건으로 재고 등록</button>
      </section>
    </div>
    <section className="card recommendation-table"><div className="toolbar"><div><p className="eyebrow">SMART BUY ANALYSIS</p><h2>시세 데이터 스마트 매입 분석</h2></div><p className="muted">최근 활성 매물·확인된 판매·순이익·ROI를 분리해 계산합니다.</p></div>
      <div className="table-wrap"><table><thead><tr><th>상품</th><th>최저 매입 후보</th><th>활성 중앙가</th><th>할인율</th><th>예상 순익</th><th>ROI</th><th>신뢰도</th><th>판정</th></tr></thead><tbody>
        {aiCandidates.slice(0, 20).map(c => <tr key={c.key}><td><b>{c.brand} {c.model}</b><small>{c.size} · 최근 활성 {c.freshCount}건 · 판매확인 {c.soldConfirmed}건</small></td><td>{won(c.offer)}</td><td>{won(c.median)}</td><td>{c.discount.toFixed(1)}%</td><td className={c.net > 0 ? "positive" : ""}>{won(c.net)}</td><td>{c.roi.toFixed(1)}%</td><td><Badge text={c.confidence} /></td><td><button className="text-button" onClick={() => setBuy({ ...buy, brand: c.brand, name: c.model, size: c.size === "-" ? "" : c.size, market: c.median, offer: c.offer, evidence: c.freshCount + c.soldConfirmed })}>{c.verdict} · {c.score}점</button></td></tr>)}
        {!aiCandidates.length && <tr><td colSpan={8}><p className="empty">시세 데이터에서 번개 CSV를 가져오면 자동 추천이 표시됩니다.</p></td></tr>}
      </tbody></table></div>
    </section>
    </>
  );

  const payDebt = (d:Debt) => {
    if(d.paid && d.priorRemaining === undefined) return note("이전 상환 당시 원금이 없습니다. 원본 상환 기록을 먼저 확인해 주세요.");
    if(![d.remaining,d.plannedPrincipal,d.interestCost].every(n=>Number.isFinite(n)&&n>=0)) return note("대출 금액을 확인해 주세요.");
    update(s=>({...s,debts:s.debts.map(x=>{
      if(x.id!==d.id)return x;
      const history=[...(x.paymentHistory||[])];
      if(x.paid){const last=history.findLastIndex(h=>!h.cancelled);if(last>=0)history[last]={...history[last],cancelled:true};return {...x,remaining:x.priorRemaining!,paid:false,lastPaidDate:"",paymentHistory:history};}
      const principal=Math.min(x.remaining,x.plannedPrincipal);
      return {...x,priorRemaining:x.remaining,lastPaidPrincipal:principal,remaining:x.remaining-principal,paid:true,lastPaidDate:today(),paymentHistory:[...history,{id:uid("PAY"),date:today(),principal,interest:x.interestCost,cancelled:false}]};
    })}),`${d.name} 납부 ${d.paid ? "취소" : "완료"} · 실제 상환 원금 보존`);
  };
  const renderMoney = () => (
    <>
      <div className="kpis">
        <Kpi label="총 통장 잔고" value={won(balances)} sub={`${state.accounts.length}개 계좌`} tone="blue" />
        <Kpi label="대출원금 잔액" value={won(state.debts.reduce((s, d) => s + d.remaining, 0))} sub={`다음 납부 ${won(upcomingDebt)}`} tone="yellow" />
        <Kpi label="재고에 묶인 원가" value={won(inventoryCost)} sub={`잔고 대비 ${balances ? (inventoryCost / balances * 100).toFixed(0) : 0}%`} tone="lavender" />
        <Kpi label="실매입 가능액" value={won(Math.max(0, buyable))} sub="최소현금·다음 납부·고정비 차감" tone="mint" />
      </div>
      <div className="grid two">
        <section className="card"><SectionTitle title="통장 잔고" action="+ 통장 추가" onClick={() => update(s => ({ ...s, accounts: [...s.accounts, { id: uid("AC"), name: "새 통장", balance: 0 }] }))} />
          {state.accounts.map(a => <div className="editable-row" key={a.id}><input value={a.name} onChange={e => update(s => ({ ...s, accounts: s.accounts.map(x => x.id === a.id ? { ...x, name: e.target.value } : x) }))} /><input type="number" value={a.balance} onChange={e => update(s => ({ ...s, accounts: s.accounts.map(x => x.id === a.id ? { ...x, balance: Number(e.target.value) } : x) }))} /><button onClick={() => update(s => ({ ...s, accounts: s.accounts.filter(x => x.id !== a.id) }))}>×</button></div>)}
        </section>
        <section className="card debt-card"><SectionTitle title="대출·상환" action="+ 대출 추가" onClick={() => update(s => ({ ...s, debts: [...s.debts, { id: uid("DB"), name: "새 대출", remaining: 0, plannedPrincipal: 0, interestCost: 0, nextPaymentDate: today(), paid: false, lastPaidDate: "" }] }))} />
          {state.debts.map(d => <div className="debt-row debt-safe" key={d.id}>
            <div><input value={d.name} onChange={e => update(s => ({ ...s, debts: s.debts.map(x => x.id === d.id ? { ...x, name: e.target.value } : x) }))} /><small>{d.paid ? `납부 완료 ${d.lastPaidDate}` : `다음 납부 ${d.nextPaymentDate}`}</small></div>
            <label>대출원금 잔액<input type="number" value={d.remaining} onChange={e => update(s => ({ ...s, debts: s.debts.map(x => x.id === d.id ? { ...x, remaining: Number(e.target.value) } : x) }))} /></label>
            <label>원금 상환액<input type="number" value={d.plannedPrincipal} onChange={e => update(s => ({ ...s, debts: s.debts.map(x => x.id === d.id ? { ...x, plannedPrincipal: Number(e.target.value), paid: false } : x) }))} /></label>
            <label>이자 비용<input type="number" value={d.interestCost} onChange={e => update(s => ({ ...s, debts: s.debts.map(x => x.id === d.id ? { ...x, interestCost: Number(e.target.value), paid: false } : x) }))} /></label>
            <label>다음 납부일<input type="date" value={d.nextPaymentDate} onChange={e => update(s => ({ ...s, debts: s.debts.map(x => x.id === d.id ? { ...x, nextPaymentDate: e.target.value, paid: false } : x) }))} /></label>
            <button className={d.paid ? "settled-button" : "primary"} onClick={() => payDebt(d)}>{d.paid ? "납부 완료 취소" : "납부 완료"}</button>
          </div>)}
          <p className="money-note">원금 상환은 순이익 비용에서 제외하고, 납부 완료된 이자만 해당 월 비용으로 반영합니다.</p>
        </section>
      </div>
      <section className="card formula"><h3>매입 한도 계산</h3><div><span>{won(balances)}<small>통장 잔고</small></span><i>+</i><span>{won(settlement)}<small>정산 예정</small></span><i>−</i><span>{won(state.settings.reserveCash)}<small>최소 보유</small></span><i>−</i><span>{won(upcomingDebt)}<small>다음 원금·이자</small></span><i>=</i><strong>{won(Math.max(0, buyable))}<small>실매입 가능액</small></strong></div></section>
    </>
  );

  const renderSeason = () => (
    <section className="card"><div className="toolbar"><div><p className="eyebrow">SEASONAL INVENTORY</p><h2>계절 재고 관리</h2></div><p className="muted">여름에 산 겨울 상품은 판매 피크 전까지 정상 선매입으로 봅니다.</p></div>
      <div className="season-legend"><span><i className="dot prep" /> 정상 선매입</span><span><i className="dot peak" /> 판매 피크</span><span><i className="dot cut" /> 인하 검토</span><span><i className="dot carry" /> 다음 시즌 이월</span></div>
      <div className="season-list">{recentItems.filter(i => active.some(a => a.id === i.id)).map(i => <article key={i.id}><div><b>{i.brand} {i.name}</b><span>{i.acquiredDate || "입고일 확인 필요"} 매입 · {i.acquiredDate ? `${days(i.acquiredDate)}일 보유` : "보유일 확인 필요"}</span></div><div className="months"><small>피크</small><b>{i.peakFrom}월 → {i.peakTo}월</b><small>철수 {i.exitMonth}월</small></div><Badge text={seasonStage(i)} /><strong>{won(totalCost(i))}</strong></article>)}</div>
    </section>
  );

  const renderQueue = () => (
    <>
      <div className="queue-hero"><div><div className="operating-mode-pill"><i /> 운영 등록 준비</div><h2>번장 등록 대기열</h2><p>실제 상품 정보와 사진을 검수하고 번개장터 공식 일괄등록 엑셀을 생성합니다.</p></div><div className="queue-hero-actions"><button className="secondary" onClick={() => { const first = queue[0]; if (!first) return note("연속 수정할 등록대기 상품이 없어요."); setContinuousQueue(true); setEditing({ ...makeDraft(first)}); }}>대기열 연속 수정</button><button className="secondary" onClick={exportQueuePhotos}>등록사진 ZIP</button><button className="primary big" onClick={() => exportBunjang()}>공식 엑셀 생성 ({queue.length})</button></div></div>
      <div className="queue-operating-summary"><div><span>등록 대기</span><strong>{queue.length}건</strong></div><div><span>검수 가능</span><strong>{state.items.filter(i => ["등록대기", "엑셀생성", "테스트완료"].includes(i.listingStatus) && !i.archivedAt && queueChecks(i).every(Boolean)).length}건</strong></div><div><span>엑셀 생성완료</span><strong>{state.items.filter(i => i.listingStatus === "엑셀생성" && !i.archivedAt).length}건</strong></div><button onClick={() => exportBunjang()}>공식 양식 다운로드</button></div>
      <div className="queue-flow" aria-label="번개장터 등록 흐름">
        <div><i>1</i><span><b>상품 정보 작성</b><small>제목·카테고리·설명·가격·사진</small></span></div>
        <em>›</em><div><i>2</i><span><b>운영 검수</b><small>필수값 5개 확인</small></span></div>
        <em>›</em><div><i>3</i><span><b>공식 엑셀 생성</b><small>번장 일괄등록 양식 다운로드</small></span></div>
        <em>›</em><div className="manual-step"><i>4</i><span><b>번장에서 업로드</b><small>공식 판매자 화면에서 최종 등록</small></span></div>
      </div>
      <div className="clean-options"><b>운영 방식</b><span>실제 사진 연결 → 필수값 검수 → 공식 양식 엑셀 생성 → 번개장터 업로드</span><b>데이터 원칙</b><span>가짜 사진·가짜 게시·테스트 완료 처리는 생성하지 않습니다.</span></div>
      <section className="card">
        <SectionTitle title="등록 대기열" action="+ 상품 등록" onClick={() => setEditing(blankItem())} />
        <div className="queue-list">{queue.map(i => {
          const checks = queueChecks(i);
          const readyForExport = checks.every(Boolean);
          return <article key={i.id}><img className="queue-thumb" src={productPhotoFor(i)} alt="" /><div><b>{i.listing.title || `${i.brand} ${i.name}`}</b><span>{i.listing.categoryId || "카테고리 미입력"} · {i.size} · {won(i.listing.price || i.expectedPrice)}</span><small>{actualListingPhotos(i.productPhotos).length ? `실제 상품사진 ${actualListingPhotos(i.productPhotos).length}장` : "실제 상품사진 연결 필요"}</small></div><span className={readyForExport ? "ready-check" : "missing-check"}>{checks.filter(Boolean).length}/5 검수</span><Badge text={i.listingStatus === "테스트완료" ? "재검수 필요" : i.listingStatus} /><div className="queue-actions"><button className="text-button" onClick={() => setEditing({ ...makeDraft(i)})}>수정</button><button className="publish-button" disabled={!readyForExport} onClick={() => exportBunjang([i.id])}>{i.listingStatus === "엑셀생성" ? "엑셀 다시 생성" : "공식 엑셀 생성"}</button><button className="secondary" onClick={() => setPublishEditing({...makeDraft(i),listingPublishedDate:today(),listingPublishedPrice:0})}>게시완료 기록</button></div></article>;
        })}</div>
      </section>
    </>
  );

  const renderAnalytics = () => {
    const visibleMonthly = monthly.slice(-salesRange);
    const selected = monthly.find(([m]) => m === salesMonth)![1];
    const selectedSales = sold.filter(i => i.saleDate && i.actualPrice > 0).filter(i => i.saleDate.startsWith(salesMonth));
    const selectedCost = selectedSales.reduce((s, i) => s + totalCost(i), 0);
    const selectedFees = selectedSales.reduce((s, i) => s + i.fee, 0);
    const selectedShipping = selectedSales.reduce((s, i) => s + i.shipping + (i.returnShipping || 0), 0);
    const selectedMargin = selected.revenue ? selected.profit / selected.revenue * 100 : 0;
    const selectedAvgPrice = selected.count ? selected.revenue / selected.count : 0;
    const selectedAvgDays = selectedSales.length ? selectedSales.reduce((s, i) => s + days(i.acquiredDate, i.saleDate), 0) / selectedSales.length : 0;
    const previousKey = (() => { const d = new Date(`${salesMonth}-01T00:00:00`); d.setMonth(d.getMonth() - 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; })();
    const previous = monthly.find(([m]) => m === previousKey)?.[1];
    const revenueChange = previous?.revenue ? (selected.revenue - previous.revenue) / previous.revenue * 100 : null;
    const chartMin = Math.min(0, ...visibleMonthly.map(([, x]) => x.profit));
    const chartMax = Math.max(1, ...visibleMonthly.map(([, x]) => Math.max(x.revenue, x.profit)));
    const chartSpan = Math.max(1, chartMax - chartMin);
    const chartX = (index: number) => visibleMonthly.length <= 1 ? 380 : 64 + index * (628 / (visibleMonthly.length - 1));
    const chartY = (value: number) => 20 + (chartMax - value) / chartSpan * 174;
    const revenuePoints = visibleMonthly.map(([, x], index) => `${chartX(index)},${chartY(x.revenue)}`).join(" ");
    const profitPoints = visibleMonthly.map(([, x], index) => `${chartX(index)},${chartY(x.profit)}`).join(" ");
    const revenueArea = visibleMonthly.length ? `${chartX(0)},${chartY(0)} ${revenuePoints} ${chartX(visibleMonthly.length - 1)},${chartY(0)}` : "";
    const yTicks = [0, .25, .5, .75, 1].map(rate => ({ y: 20 + rate * 174, value: chartMax - rate * chartSpan }));
    const compactWon = (value: number) => value >= 10000000 ? `${(value / 10000000).toFixed(1)}천만` : value >= 10000 ? `${Math.round(value / 10000)}만` : `${Math.round(value / 1000)}천`;
    const expenseTotal = Math.max(1, selectedCost + selectedFees + selectedShipping + selected.interest + Math.max(0, selected.profit));
    const costParts = [
      { label: "상품 원가", value: selectedCost, color: "#3182f6" },
      { label: "수수료", value: selectedFees, color: "#7b61ff" },
      { label: "배송·반품", value: selectedShipping, color: "#f5a623" },
      { label: "대출 이자", value: selected.interest, color: "#f04452" },
      { label: "순이익", value: Math.max(0, selected.profit), color: "#00a878" },
    ];
    let angle = 0;
    const donut = costParts.map(part => {
      const start = angle;
      angle += part.value / expenseTotal * 360;
      return `${part.color} ${start}deg ${angle}deg`;
    }).join(", ");
    return <>
      <div className="simple-head compact">
        <div><p className="eyebrow">월별 매출 현황</p><h1>매출관리</h1><p>월별 매출과 순이익의 흐름을 한눈에 확인해요.</p></div>
        <div className="sales-head-actions"><select aria-label="확인할 매출 월" value={salesMonth} onChange={e => setSalesMonth(e.target.value)}>{[...monthly].reverse().map(([m]) => <option value={m} key={m}>{m.replace("-", "년 ")}월</option>)}</select><button className="primary big" onClick={() => { setInventoryFilter("판매중"); setView("inventory"); }}>판매완료 처리</button></div>
      </div>
      <p className="finance-note">환불은 반품 월에 반영합니다. 원가 미확인 {selected.unknownProfit}건은 순이익에서 제외합니다. 월말 재고는 입고·판매·반품일 기록 기준이며 누락된 날짜는 추정하지 않습니다. 선택 월 환불액 {won(selected.refunds)}.</p><div className="monthly-hero">
        <div className="monthly-primary">
          <span>{salesMonth.replace("-", "년 ")}월 매출</span>
          <strong>{won(selected.revenue)}</strong>
          <small className={revenueChange !== null && revenueChange >= 0 ? "up" : "down"}>{revenueChange === null ? "지난달 비교 데이터 없음" : `지난달보다 ${revenueChange >= 0 ? "+" : ""}${revenueChange.toFixed(1)}%`}</small>
        </div>
        <div className="monthly-metrics">
          <div><span>순이익</span><strong className={selected.profit >= 0 ? "positive" : "negative"}>{won(selected.profit)}</strong><small>마진율 {selectedMargin.toFixed(1)}%</small></div>
          <div><span>판매 건수</span><strong>{selected.count}건</strong><small>건당 평균 {won(selectedAvgPrice)}</small></div>
          <div><span>평균 판매기간</span><strong>{selectedSales.length ? `${Math.round(selectedAvgDays)}일` : "-"}</strong><small>입고일부터 판매까지</small></div>
        </div>
      </div>
      <div className="sales-visual-grid">
        <section className="card trend-card">
          <div className="section-title"><div><h3>매출·순이익 추이</h3><p>월별 변화와 성장 흐름</p></div><div className="range-tabs">{([6, 12, 18] as const).map(range => <button className={salesRange === range ? "active" : ""} key={range} onClick={() => setSalesRange(range)}>{range}개월</button>)}</div></div>
          <div className="trend-chart">
            <svg viewBox="0 0 720 230" role="img" aria-label={`${salesRange}개월 매출과 순이익 추이 그래프`}>
              <defs><linearGradient id="revenueArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3182f6" stopOpacity=".18" /><stop offset="100%" stopColor="#3182f6" stopOpacity="0" /></linearGradient></defs>
              {yTicks.map(tick => <g key={tick.y}><line x1="64" x2="692" y1={tick.y} y2={tick.y} className="grid-line" /><text x="54" y={tick.y + 3} textAnchor="end" className="axis-label">{compactWon(tick.value)}</text></g>)}
              {chartMin < 0 && <line x1="64" x2="692" y1={chartY(0)} y2={chartY(0)} className="zero-line" />}
              <polygon points={revenueArea} className="revenue-area" />
              <polyline points={revenuePoints} className="revenue-line" />
              <polyline points={profitPoints} className="profit-line" />
              {visibleMonthly.map(([m, x], index) => <g key={m} className={m === salesMonth ? "selected-month" : ""}><circle cx={chartX(index)} cy={chartY(x.revenue)} r={m === salesMonth ? "6" : "4"} className="revenue-dot"><title>{m} 매출 {won(x.revenue)}</title></circle><circle cx={chartX(index)} cy={chartY(x.profit)} r={m === salesMonth ? "6" : "4"} className="profit-dot"><title>{m} 순이익 {won(x.profit)}</title></circle><text x={chartX(index)} y="220" textAnchor="middle">{m.slice(5)}월</text></g>)}
            </svg>
          </div>
          <div className="chart-legend modern"><span><i className="rev" />매출</span><span><i className="pro" />순이익</span><small>실제 판매완료 기록 기준 · 빈 달은 0원</small></div>
        </section>
        <section className="card cost-card">
          <div className="section-title"><div><h3>매출 구성</h3><p>{salesMonth.replace("-", "년 ")}월 기준</p></div></div>
          <div className="donut-wrap">
            <div className="donut" style={{ background: selected.revenue ? `conic-gradient(${donut})` : "#eef1f4" }}><div><span>순이익률</span><strong>{selectedMargin.toFixed(1)}%</strong></div></div>
            <div className="cost-legend">{costParts.map(part => <div key={part.label}><span><i style={{ background: part.color }} />{part.label}</span><b>{won(part.value)}</b></div>)}</div>
          </div>
        </section>
      </div>
      <section className="card main-card monthly-sales-list">
        <div className="section-title"><div><h3>{salesMonth.slice(5)}월 판매내역</h3><p>{selectedSales.length}건의 판매 기록</p></div>{selectedSales.some(i => i.settlementStatus === "정산대기") && <button onClick={() => { const ids = new Set(selectedSales.filter(i => i.settlementStatus === "정산대기").map(i => i.id)); update(s => ({ ...s, items: s.items.map(i => ids.has(i.id) ? { ...i, settlementStatus: "정산완료" } : i) }), `정산대기 ${ids.size}건 일괄 완료`); note(`${ids.size}건을 정산완료로 처리했어요.`); }}>선택 월 정산대기 완료 →</button>}</div>
        <div className="table-wrap"><table><thead><tr><th>상품</th><th>판매일</th><th>판매가</th><th>수수료·배송비</th><th>순이익</th><th>정산</th><th></th></tr></thead><tbody>
          {[...selectedSales].sort((a, b) => (b.saleDate || "").localeCompare(a.saleDate || "")).map(i => <tr key={i.id}><td><b>{i.brand} {i.name}</b><small>{i.size || "-"} · 원가 {won(totalCost(i))}</small></td><td>{i.saleDate}</td><td>{won(revenue(i))}</td><td>{won(i.fee + i.shipping + (i.returnShipping || 0))}</td><td className={profit(i) >= 0 ? "positive" : "negative"}><b>{totalCost(i)>0 ? won(profit(i)) : "원가 확인 필요"}</b></td><td><Badge text={i.settlementStatus} /></td><td><button className="text-button" onClick={() => setSaleEditing({ ...makeDraft(i)})}>판매정보</button></td></tr>)}
          {!selectedSales.length && <tr><td colSpan={7} className="empty-month">이 달의 판매완료 기록이 없어요.</td></tr>}
        </tbody></table></div>
      </section>
      <details className="advanced-report"><summary>고급 매출 분석 보기</summary><section className="card"><div className="toolbar"><div><p className="eyebrow">MONTHLY CASH FLOW</p><h2>월별 매입·판매 데이터</h2></div><p className="muted">매출만 보지 않고 그 달에 새로 재고에 묶인 원가까지 같이 확인합니다.</p></div>
        <div className="table-wrap"><table><thead><tr><th>월</th><th>매입 건수</th><th>매입 원가</th><th>판매 건수</th><th>매출</th><th>순이익</th><th>매출-매입</th><th>전년 동월 순익</th><th>월말 재고원가</th></tr></thead><tbody>{[...monthly].reverse().map(([m, x]) => {
          const prior = monthly.find(([pm]) => pm === `${Number(m.slice(0, 4)) - 1}-${m.slice(5)}`)?.[1];
          return <tr key={m}><td><b>{m}</b></td><td>{x.purchaseCount}건</td><td>{won(x.purchases)}</td><td>{x.count}건</td><td>{won(x.revenue)}</td><td className={x.profit >= 0 ? "positive" : ""}>{won(x.profit)}</td><td>{won(x.revenue - x.purchases)}</td><td>{prior ? won(prior.profit) : "-"}</td><td>{won(x.inventory)}</td></tr>;
        })}</tbody></table></div>
      </section>
      <section className="card"><div className="toolbar"><div><p className="eyebrow">MY SALES PATTERN</p><h2>내가 잘 파는 상품군</h2></div><p className="muted">브랜드·카테고리·사이즈 기준. 속도 45% + 수익 35% + 손해위험 20%, 유효 판매 2건 미만은 표본 부족입니다.</p></div>
        <div className="table-wrap"><table><thead><tr><th>브랜드 · 카테고리 · 사이즈</th><th>유효판매/전체</th><th>평균 판매일</th><th>90일 내 판매율</th><th>평균 순익</th><th>손해율</th><th>재매입 점수</th></tr></thead><tbody>{groups.map(g => <tr key={g.key}><td><b>{g.key}</b></td><td>{g.sold}/{g.total}</td><td>{g.sold ? `${g.avgDays.toFixed(0)}일` : "-"}</td><td>{g.sold ? `${g.within90.toFixed(0)}%` : "-"}</td><td>{g.sold ? won(g.avgProfit) : "-"}</td><td>{g.sold ? `${g.loss.toFixed(0)}%` : "-"}</td><td>{g.score === null ? <Badge text="표본 부족" /> : <strong className={g.score >= 70 ? "positive" : ""}>{g.score}점</strong>}</td></tr>)}</tbody></table></div>
      </section></details>
    </>;
  };

  const renderMarket = () => {
    const latest = state.snapshots[0]; const previous = state.snapshots.find(s => latest && s.brand === latest.brand && s.model === latest.model && s.id !== latest.id);
    return <>
      <div className="queue-hero"><div><p className="eyebrow">BUNJANG MARKET DATA</p><h2>시세 데이터 가져오기</h2><p>products.csv를 불러오면 최근 활성 매물과 확인된 판매를 분리해 스마트 분석에 반영합니다.</p></div><button className="primary big" onClick={() => marketCsvRef.current?.click()}>products.csv 가져오기</button></div>
      <input ref={marketCsvRef} hidden type="file" accept=".csv,text/csv" onChange={importMarketCsv} />
      <div className="clean-options"><b>필수 열</b><span>listing_id 또는 product_id · title · price</span><b>선택 열</b><span>brand · model · size · color · url · first_seen_at · last_seen_at · is_active</span></div>
      <div className="kpis market-kpis"><Kpi label="누적 시세 매물" value={`${state.marketListings.length}건`} sub="같은 ID는 최신 값으로 갱신" tone="blue" /><Kpi label="통합 상품" value={`${marketProducts.length}개`} sub="브랜드·모델·카테고리·사이즈·색상 기준" tone="mint" /><Kpi label="판매 확인 표본" value={`${state.marketListings.filter(x => x.soldConfirmed).length}건`} sub="판매가 확인된 경우만 속도 추정" tone="yellow" /><Kpi label="분석 후보" value={`${aiCandidates.filter(x => x.score >= 65).length}개`} sub="점수 65점 이상 · 신뢰도 별도 표시" tone="lavender" /></div>
    <div className="grid market-layout">
      <section className="card"><p className="eyebrow">MARKET SNAPSHOT</p><h2>시세 스냅샷 추가</h2>
        <form className="form-grid" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); const snap: Snapshot = { id: uid("SP"), date: String(f.get("date")), brand: String(f.get("brand")).trim(), model: String(f.get("model")).trim(), size: String(f.get("size")).trim(), price: Number(f.get("price")), source: String(f.get("source")), note: String(f.get("note")) }; const duplicate = state.snapshots.some(s => s.date === snap.date && normalize(s.brand) === normalize(snap.brand) && normalize(s.model) === normalize(snap.model) && normalize(s.size) === normalize(snap.size) && s.price === snap.price && s.source === snap.source); if (duplicate) return note("같은 날짜·상품·가격의 시세가 이미 있어요."); update(s => ({ ...s, snapshots: [snap, ...s.snapshots] }), `${snap.brand} ${snap.model} 시세 저장`); e.currentTarget.reset(); note("오늘 시세를 저장했어요."); }}>
          <FieldN name="date" label="기준일" type="date" defaultValue={today()} /><FieldN name="brand" label="브랜드" /><FieldN name="model" label="모델" /><FieldN name="size" label="사이즈" /><FieldN name="price" label="중앙 시세" type="number" /><SelectN name="source" label="출처" options={["번개장터", "KREAM", "당근", "후르츠", "패밀리", "직접조사"]} /><FieldN name="note" label="표본·상태 메모" wide /><button className="primary wide">스냅샷 저장</button>
        </form>
      </section>
      <section className="card"><SectionTitle title="최근 시세 변화" />
        {latest ? <><div className="market-head"><div><b>{latest.brand} {latest.model}</b><span>{latest.size} · {latest.source}</span></div><strong>{won(latest.price)}</strong></div><div className="market-change"><span>이전 기록 대비</span><b>{previous ? `${latest.price >= previous.price ? "+" : ""}${((latest.price - previous.price) / previous.price * 100).toFixed(1)}%` : "비교 기록 없음"}</b></div></> : <p className="empty">시세를 저장해 주세요.</p>}
        <div className="snapshot-list">{state.snapshots.slice(0, 8).map(s => <div key={s.id}><span>{s.date}</span><b>{s.brand} {s.model}</b><span>{s.source}</span><strong>{won(s.price)}</strong></div>)}</div>
      </section>
    </div>
    </>;
  };

  const renderSettings = () => (
    <>
    <div className="simple-head compact"><div><p className="eyebrow">MORE</p><h1>더보기</h1><p>자주 쓰지 않는 기능과 데이터 관리는 이곳에 모았어요.</p></div></div>
    <div className="more-grid">
      <button onClick={() => setView("buy")}><i>◎</i><span><b>매입 분석</b><small>목표 수익과 최대 매입가 계산</small></span><em>›</em></button>
      <button onClick={() => setView("season")}><i>◷</i><span><b>계절 재고</b><small>판매 피크와 장기재고 확인</small></span><em>›</em></button>
      <button onClick={() => setView("market")}><i>⌁</i><span><b>시세 데이터</b><small>번장 CSV와 시세 스냅샷</small></span><em>›</em></button>
      <button onClick={() => setView("products")}><i>◇</i><span><b>상품 라이브러리</b><small>모델·사이즈별 시세 묶음</small></span><em>›</em></button>
      <button onClick={() => setAllocation({ open: true, total: 0, method: "예상판매가 비율", ids: [] })}><i>∑</i><span><b>묶음 원가 배분</b><small>여러 상품의 총 매입가 나누기</small></span><em>›</em></button>
      <button onClick={() => excelRef.current?.click()}><i>↓</i><span><b>재고 엑셀 가져오기</b><small>상품코드 기준으로 안전하게 병합</small></span><em>›</em></button><input ref={excelRef} hidden type="file" accept=".xlsx,.xls" onChange={importExcel} />
    </div>
    <div className="grid two settings-area">
      <section className="card"><p className="eyebrow">RULES</p><h2>매입 기준</h2><div className="settings-list">
        <Setting label="최소 보유 현금" value={state.settings.reserveCash} suffix="원" onChange={v => update(s => ({ ...s, settings: { ...s.settings, reserveCash: v } }))} />
        <Setting label="월 확정 고정지출" value={state.settings.fixedExpenses} suffix="원" onChange={v => update(s => ({ ...s, settings: { ...s.settings, fixedExpenses: v } }))} />
        <Setting label="목표 ROI" value={state.settings.targetRoi} suffix="%" onChange={v => update(s => ({ ...s, settings: { ...s.settings, targetRoi: v } }))} />
        <Setting label="최소 목표 순익" value={state.settings.targetProfit} suffix="원" onChange={v => update(s => ({ ...s, settings: { ...s.settings, targetProfit: v } }))} />
        <Setting label="기본 플랫폼 수수료율" value={state.settings.feeRate * 100} suffix="%" onChange={v => update(s => ({ ...s, settings: { ...s.settings, feeRate: v / 100 } }))} />
        <Setting label="기본 판매 배송비" value={state.settings.defaultShipping} suffix="원" onChange={v => update(s => ({ ...s, settings: { ...s.settings, defaultShipping: v } }))} />
      </div></section>
      <section className="card"><p className="eyebrow">DATA SAFETY</p><h2>서버 저장·백업</h2><p className="muted">같은 ChatGPT 계정으로 로그인하면 PC·휴대폰 어디서든 같은 서버 데이터를 불러옵니다. 재고·판매·자금·대출·시세는 D1에 자동 저장되고 최근 변경본 30개가 보관되며, 상품사진·증빙은 R2에 별도 저장됩니다.</p>
        <div className="backup-box"><button className="primary" onClick={exportBackup}>원장 JSON 백업</button><button className="secondary" disabled={portableBusy} onClick={exportPortableBackup}>{portableBusy ? "사진 백업 중" : "사진 포함 백업"}</button><button className="secondary" onClick={exportAllExcel}>전체 엑셀 내보내기</button><button className="secondary" onClick={() => { const raw=localStorage.getItem("deal_hunter_v5_recovery"); if(!raw)return note("보존된 이전 로컬본이 없습니다."); download(new Blob([raw],{type:"application/json"}),`Deal_Hunter_이전로컬본_${today()}.json`); }}>이전 로컬본 보관</button><button className="secondary" onClick={() => fileRef.current?.click()}>기존 데이터 가져오기</button><button className="secondary" onClick={loadServerVersions}>서버 이전 버전</button><input ref={fileRef} hidden type="file" accept=".json,.html,text/html,application/json" onChange={importBackup} /></div>
        <div className="storage-info"><span>저장 상태</span><code>{sync.status} · revision {sync.revision}</code><small>{sync.updatedAt ? `마지막 서버 저장 ${new Date(sync.updatedAt).toLocaleString("ko-KR")}` : "최초 저장 대기 중"} · 새 PC 로그인 시 서버 최신본을 자동으로 불러오며 브라우저에는 비상 복구본도 남습니다.</small></div>{serverNeedsInitialCommit && <div className="initial-server-warning"><b>새 서버가 비어 있습니다.</b><small>기존 백업 확인 전에는 자동 저장하지 않습니다.</small><button className="primary" onClick={commitInitialServerState}>현재 데이터를 최초 서버 기준본으로 저장</button></div>}
        {versionsOpen && <div className="version-box"><div className="version-head"><b>서버 자동 복원 기록</b><button className="secondary" onClick={() => setVersionsOpen(false)}>닫기</button></div><small>현재 데이터를 덮어쓰기 전에 현재 상태를 다시 보관하므로 복원 작업 자체도 되돌릴 수 있습니다.</small>{serverVersions.length ? <div className="version-list">{serverVersions.map(v => <div className="version-row" key={v.id}><span><b>revision {v.revision}</b><small>{new Date(v.createdAt).toLocaleString("ko-KR")}</small></span><button className="secondary" disabled={restoringVersion} onClick={() => restoreServerVersion(v.id, v.revision)}>이 상태로 복원</button></div>)}</div> : <p className="muted">아직 이전 서버 버전이 없습니다. 서버 저장이 누적되면 최대 30개가 표시됩니다.</p>}</div>}
        {sync.conflict && <div className="conflict-actions"><button className="secondary" onClick={downloadConflictBackup}>내 변경사항 JSON 보관</button><button className="secondary" onClick={() => { downloadConflictBackup(); try { localStorage.removeItem("deal_hunter_v5_draft"); } catch {} location.reload(); }}>내 변경 백업 후 서버 최신본 사용</button></div>}
        <p className="muted">원장 초기화 기능은 제거했습니다. 변경 전 JSON 백업과 서버 복원 기록을 사용하세요.</p>
      </section>
      <section className="card wide-card"><SectionTitle title="최근 작업 이력" /><div className="audit">{state.audit.slice(0, 12).map((a, i) => <div key={`${a.at}-${i}`}><span>{new Date(a.at).toLocaleString("ko-KR")}</span><b>{a.action}</b></div>)}</div></section>
    </div></>
  );

  if (!ready) {
    return <main className="loading-screen"><div><span>D</span><b>DEAL HUNTER V5</b><small>판매 데이터를 불러오는 중</small></div></main>;
  }

  return (
    <main className="app-shell">
      {restoringVersion && <div className="sync-shield" role="status">이전 버전을 복원하는 중입니다…</div>}
      <aside>
        <div className="brand-mark"><span>D</span><div><b>Deal Hunter</b><small>리셀 운영관리</small></div></div>
        <nav>{nav.map(n => <button key={n.id} className={view === n.id || n.id === "settings" && ["products", "buy", "season", "market"].includes(view) ? "active" : ""} onClick={() => setView(n.id)}><i>{n.icon}</i>{n.label}{n.id === "queue" && queue.length > 0 && <em>{queue.length}</em>}</button>)}</nav>
        <div className="side-foot"><span className={`live-dot ${sync.conflict ? "conflict" : ""}`} /> {sync.status}<small>{sync.updatedAt ? new Date(sync.updatedAt).toLocaleTimeString("ko-KR") : "서버 + 비상 로컬 저장"}</small></div>
      </aside>
      <div className="content-shell">
        <header><div><p>{viewLabels[view]}</p><small>{today()}</small></div><div className="header-actions"><span className={`save-status ${sync.conflict || loadIssue === "connection" ? "conflict" : ""}`}>{isSaving ? "저장 중 · 창을 닫지 마세요" : sync.status}</span><button className="avatar">DY</button></div></header>
        <div className="content">
          {loadIssue && <div className={`load-banner ${loadIssue}`}><div><b>{loadIssue === "connection" ? "서버에 연결하지 못했어요" : "서버에 저장된 데이터가 아직 없어요"}</b><span>{loadIssue === "connection" ? "마지막 정상 데이터를 임시로 표시하고 있습니다." : "현재 표시된 기준 데이터를 처음 저장할 수 있습니다."}</span></div>{loadIssue === "connection" && <button onClick={() => setLoadNonce(n => n + 1)}>다시 시도</button>}</div>}
          {view === "home" && renderHome()}{view === "inventory" && renderInventory()}{view === "evidence" && renderEvidence()}{view === "products" && renderProducts()}{view === "buy" && renderBuy()}
          {view === "money" && renderMoney()}{view === "season" && renderSeason()}{view === "queue" && renderQueue()}
          {view === "pricing" && <Pricing items={state.items} feeRate={state.settings.feeRate} shipping={state.settings.defaultShipping} onApply={(drafts,ids) => {
            if (import.meta.env.VITE_ENABLE_PRICE_CHANGES !== "true") return note("가격 적용은 보류 중입니다.");
            if (!confirm(`선택한 ${ids.length}개 상품의 원장 등록가를 변경할까요? 번장 게시 가격은 별도로 수정해야 합니다.`)) return;
            const at = new Date().toISOString();
            update(s => ({...s,items:s.items.map(i => ids.includes(i.id) && !i.archivedAt && ["등록대기","판매중","예약중","재고"].includes(i.inventoryStatus) && Number.isFinite(drafts[i.id]) && drafts[i.id] > 0 ? {...i,expectedPrice:drafts[i.id],listing:{...i.listing,price:drafts[i.id]},priceCuts:i.priceCuts + (drafts[i.id] < (i.listing.price||i.expectedPrice) ? 1 : 0),priceHistory:[...(i.priceHistory||[]),{from:i.listing.price||i.expectedPrice,to:drafts[i.id],at}],updatedAt:at} : i)}),`선택 상품 ${ids.length}건 가격 변경`);
          }}/>}{view === "analytics" && renderAnalytics()}{view === "market" && renderMarket()}{view === "settings" && renderSettings()}
        </div>
      </div>
      {editing && <ItemDrawer item={editing} setItem={setEditing} onClose={() => { setEditing(null); setContinuousQueue(false); }} onSave={e => saveItem(e)} onPhotos={addProductPhotos} onRemovePhoto={removeProductPhoto} onSale={() => {
        setSaleEditing(makeSaleDraft(editing));
        setEditing(null);
      }} onPurchase={() => {
        setPurchaseEditing({ ...makeDraft(editing)});
        setEditing(null);
      }} onQueue={() => {
        if(staleDraft(editing)) return note("다른 기기에서 변경됐어요. 상품을 다시 열어 주세요.");
        if (!editing.listing.title || !editing.listing.categoryId || !editing.listing.description || !editing.listing.price) return note("제목·카테고리 ID·설명·가격을 입력해 주세요.");
        const next = { ...editing, listingStatus: "등록대기", listing: { ...editing.listing, imageNames: editing.productPhotos.length ? actualListingPhotos(editing.productPhotos).map(p => p.name) : editing.listing.imageNames.filter(n => !n.startsWith("test-product-")) } };
        delete next.originalId; delete next.editBase;
        setEditing(next); update(s => ({ ...s, items: s.items.some(i => i.id === next.id) ? s.items.map(i => i.id === next.id ? next : i) : [next, ...s.items] }), `${next.id} 번장 운영 대기열 추가`); setEditing(null); setView("queue"); note("번장 운영 대기열에 추가했어요.");
      }} />}
      {purchaseEditing && <PurchaseDrawer item={purchaseEditing} setItem={setPurchaseEditing} saving={savingPurchase} onClose={() => setPurchaseEditing(null)} onSave={e => savePurchase(e)} onSaveNext={e => savePurchase(e, true)} onEvidence={addPurchaseEvidence} onRemoveEvidence={removePurchaseEvidence} />}
      {saleEditing && <SaleDrawer item={saleEditing} setItem={setSaleEditing} onClose={() => setSaleEditing(null)} onSave={saveSale} onUndo={() => undoSale(saleEditing)} onReturn={() => setReturnEditing({ ...makeDraft(saleEditing), returnDate: today(), refundAmount: saleEditing.actualPrice, returnDisposition: "재고 복귀" })} />}
      {returnEditing && <ReturnDrawer item={returnEditing} setItem={setReturnEditing} onClose={() => setReturnEditing(null)} onSave={saveReturn} />}
      {publishEditing && <PublishDrawer item={publishEditing} setItem={setPublishEditing} onClose={() => setPublishEditing(null)} onSave={savePublished} />}
      <nav className="mobile-nav">{nav.map(n => <button key={n.id} className={view === n.id || n.id === "settings" && ["products", "buy", "season", "market"].includes(view) ? "active" : ""} onClick={() => setView(n.id)}><i>{n.icon}</i><span>{n.label}</span>{n.id === "queue" && queue.length > 0 && <em>{queue.length}</em>}</button>)}</nav>
      {allocation.open && <div className="drawer-backdrop center-modal" onMouseDown={e => e.target === e.currentTarget && setAllocation({ ...allocation, open: false })}><div className="allocation-modal">
        <div className="drawer-head"><div><p className="eyebrow">BUNDLE COST</p><h2>묶음 매입 원가 배분</h2></div><button onClick={() => setAllocation({ ...allocation, open: false })}>×</button></div>
        <div className="allocation-body"><p className="muted">같이 산 상품을 고르고 실제 총 결제액을 입력하면 상품별 매입가로 나눕니다.</p>
          <div className="form-grid"><Field label="총 상품 매입금액" value={allocation.total} type="number" suffix="원" onChange={v => setAllocation({ ...allocation, total: Number(v) })} /><Select label="배분 방식" value={allocation.method} options={["예상판매가 비율", "균등 배분"]} onChange={v => setAllocation({ ...allocation, method: v })} /></div>
          <div className="allocation-list">{active.map(i => <label key={i.id}><input type="checkbox" checked={allocation.ids.includes(i.id)} onChange={e => setAllocation({ ...allocation, ids: e.target.checked ? [...allocation.ids, i.id] : allocation.ids.filter(id => id !== i.id) })} /><span><b>{i.brand} {i.name}</b><small>{i.id} · 예상 {won(i.expectedPrice)}</small></span></label>)}</div>
          <div className="allocation-preview">{allocation.ids.map(id => {
            const item = state.items.find(i => i.id === id)!;
            const chosen = state.items.filter(i => allocation.ids.includes(i.id));
            const weight = allocation.method === "균등 배분" ? 1 / Math.max(1, chosen.length) : item.expectedPrice / Math.max(1, chosen.reduce((s, i) => s + i.expectedPrice, 0));
            return <div key={id}><span>{item.brand} {item.name}</span><b>{won(Math.round(allocation.total * weight))}</b></div>;
          })}</div>
        </div>
        <div className="drawer-actions"><button className="secondary" onClick={() => setAllocation({ ...allocation, open: false })}>취소</button><button className="primary" onClick={() => {
          if (!allocation.total || allocation.ids.length < 2) return note("상품 2개 이상과 총 매입금액을 입력해 주세요.");
          const chosen = state.items.filter(i => allocation.ids.includes(i.id));
          const totalWeight = allocation.method === "균등 배분" ? chosen.length : chosen.reduce((s, i) => s + i.expectedPrice, 0);
          let allocated = 0;
          const exact = new Map(chosen.map((item, index) => {
            const weight = allocation.method === "균등 배분" ? 1 / chosen.length : item.expectedPrice / Math.max(1, totalWeight);
            const amount = index === chosen.length - 1 ? allocation.total - allocated : Math.round(allocation.total * weight);
            allocated += amount;
            return [item.id, amount];
          }));
          if ([...exact.values()].reduce((sum, value) => sum + value, 0) !== allocation.total) return note("배분 합계가 총 매입액과 맞지 않아요.");
          update(s => ({ ...s, items: s.items.map(i => {
            if (!allocation.ids.includes(i.id)) return i;
            const before = i.purchasePrice;
            const after = exact.get(i.id) || 0;
            return { ...i, purchasePrice: after, purchaseHistory: before !== after ? [{ from: before, to: after, at: new Date().toISOString() }, ...(i.purchaseHistory || [])] : i.purchaseHistory };
          }) }), `묶음 매입 ${allocation.ids.length}개 원가 배분`);
          setAllocation({ ...allocation, open: false }); note("묶음 총액을 상품별 원가로 배분했어요.");
        }}>원가 배분 적용</button></div>
      </div></div>}
      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: string }) { return <article className={`kpi ${tone}`}><span>{label}</span><strong>{value}</strong><small>{sub}</small></article>; }
function SectionTitle({ title, action, onClick }: { title: string; action?: string; onClick?: () => void }) { return <div className="section-title"><h3>{title}</h3>{action && <button onClick={onClick}>{action} →</button>}</div>; }
function MarketplaceRegistration({ item }: { item: Item }) {
  const links = marketplaceLinks(item);
  const status = registrationState(item);
  return <div className={`marketplace-registration ${status === "등록완료" ? "registered" : status === "미등록" ? "unlisted" : "unchecked"}`} onClick={e => e.stopPropagation()}>
    <span className="marketplace-registration-label">{status === "등록완료" ? "등록완료 · 번개장터" : status === "미등록" ? "미등록 · 번개장터" : "번개장터 · 등록 확인 필요"}</span>
    {links.map(link => <a key={link.url} href={link.url} target="_blank" rel="noreferrer" title={`${link.shop || "상점 확인 필요"}${link.checkedAt ? ` · 확인일 ${link.checkedAt.slice(0,10)}` : ""}`}><span>{link.shop || "상점 확인 필요"}</span>{link.observedStatus && <small>{link.observedStatus}</small>}</a>)}
    {status === "등록완료" && !links.length && <small>상점·판매글 확인 필요</small>}
  </div>;
}

function Badge({ text }: { text: string }) { const tone = /피크|완료|판매중|정상/.test(text) ? "good" : /인하|이월|미등록|부족/.test(text) ? "warn" : "plain"; return <span className={`badge ${tone}`}>{text}</span>; }
function Field({ label, value, onChange, type = "text", suffix }: { label: string; value: string | number; onChange: (v: string) => void; type?: string; suffix?: string }) { return <label className="field"><span>{label}</span><div><input type={type} value={value} onChange={e => onChange(e.target.value)} />{suffix && <em>{suffix}</em>}</div></label>; }
function Select({ label, value, options, optionLabels, onChange }: { label: string; value: string; options: string[]; optionLabels?: string[]; onChange: (v: string) => void }) { return <label className="field"><span>{label}</span><select value={value} onChange={e => onChange(e.target.value)}>{options.map((o, index) => <option key={o} value={o}>{optionLabels?.[index] || o}</option>)}</select></label>; }
function FieldN({ name, label, type = "text", defaultValue, wide }: { name: string; label: string; type?: string; defaultValue?: string; wide?: boolean }) { return <label className={`field ${wide ? "wide" : ""}`}><span>{label}</span><input name={name} type={type} defaultValue={defaultValue} required /></label>; }
function SelectN({ name, label, options }: { name: string; label: string; options: string[] }) { return <label className="field"><span>{label}</span><select name={name}>{options.map(o => <option key={o}>{o}</option>)}</select></label>; }
function Setting({ label, value, suffix, onChange }: { label: string; value: number; suffix: string; onChange: (v: number) => void }) { return <label><span>{label}</span><div><input type="number" value={value} onChange={e => onChange(Number(e.target.value))} /><em>{suffix}</em></div></label>; }

function ItemDrawer({ item, setItem, onClose, onSave, onPhotos, onRemovePhoto, onQueue, onSale, onPurchase }: { item: Item; setItem: (x: Item) => void; onClose: () => void; onSave: (e: FormEvent) => void; onPhotos: (e: ChangeEvent<HTMLInputElement>) => void; onRemovePhoto: (index: number) => void; onQueue: () => void; onSale: () => void; onPurchase: () => void }) {
  const set = (key: keyof Item, value: any) => setItem({ ...item, [key]: value });
  const list = (key: keyof Listing, value: any) => setItem({ ...item, listing: { ...item.listing, [key]: value } });
  return <div className="drawer-backdrop registration-backdrop"><form className="drawer registration-page" onSubmit={onSave}>
    <div className="drawer-head registration-head"><div><p className="eyebrow">{item.originalId ? "EDIT PRODUCT" : "NEW PRODUCT"}</p><h2>{item.originalId ? "상품정보 수정" : "상품정보 등록"}</h2><span>사진·상품정보·번장 판매정보만 수정해요.</span></div><button type="button" aria-label="닫기" onClick={onClose}>×</button></div>
    <div className="registration-body">
      {item.originalId && <div className="record-links"><button type="button" onClick={onPurchase}>매입정보·증빙 보기</button>{item.inventoryStatus !== "판매완료" ? <button type="button" className="sale-link" onClick={onSale}>이 상품 판매완료</button> : <button type="button" className="sale-link sold" onClick={onSale}>판매정보 보기</button>}</div>}
      {!!item.estimatedFields?.length && <div className="estimated-notice"><span>임시 입력</span><p><b>{item.estimatedFields.length}개 항목을 대략 채워뒀어요.</b><small>{item.estimatedFields.join(" · ")} · 정확한 정보를 알게 되면 이 화면에서 수정하면 돼요.</small></p></div>}
      <section className="form-section photo-section"><div className="form-label"><b>상품 사진</b><small>상품을 보여주는 사진만 보관해요. 매입증빙은 별도 메뉴에 있어요.</small></div><div><label className="photo-drop"><input type="file" multiple accept="image/*" onChange={onPhotos} /><span>＋</span><b>상품 사진 추가</b><small>파일당 8MB 이하</small></label><div className="attachment-list compact">{item.productPhotos.map((a, idx) => <div key={`${a.name}-${idx}`}><a href={a.url || a.data} target="_blank" rel="noreferrer">{a.kind === "reference" ? `제품 참고사진 · ${a.name}` : a.name}</a>{a.kind === "reference" && a.sourceUrl && <a href={a.sourceUrl} target="_blank" rel="noreferrer">출처</a>}<button type="button" onClick={() => onRemovePhoto(idx)}>삭제</button></div>)}</div></div></section>

      <section className="form-section"><div className="form-label"><b>상품 정보</b><small>재고 검색과 번장 등록에 사용돼요.</small></div><div className="vertical-fields">
        <Field label="상품명 *" value={item.name} onChange={v => set("name", v)} />
        <div className="form-grid"><Field label="브랜드 *" value={item.brand} onChange={v => set("brand", v)} /><Select label="카테고리 *" value={item.category} options={["아우터", "상의", "하의", "신발", "가방", "액세서리", "기타 의류"]} onChange={v => set("category", v)} /><Field label="사이즈 *" value={item.size} onChange={v => set("size", v)} /><Select label="상품 상태 *" value={item.condition} options={["S", "A", "B", "C"]} onChange={v => set("condition", v)} /></div>
      </div></section>

      <section className="form-section"><div className="form-label"><b>판매가격</b><small>매입가격은 매입정보에서 따로 관리해요.</small></div><div className="form-grid">
        <Field label="판매가격 *" value={item.listing.price || item.expectedPrice} type="number" suffix="원" onChange={v => { setItem({ ...item, expectedPrice: Number(v), listing: { ...item.listing, price: Number(v) } }); }} />
        <Field label="최저 판매가" value={item.minimumPrice} type="number" suffix="원" onChange={v => set("minimumPrice", Number(v))} />
      </div></section>

      <section className="form-section"><div className="form-label"><b>번장 등록 정보</b><small>엑셀 생성에 꼭 필요한 항목만 표시해요.</small></div><div className="vertical-fields">
        <MarketplaceRegistration item={item} />
        {!marketplaceLinks(item).length && <Select label="번장 등록 확인" value={item.listingMatchStatus || "확인 필요"} options={["확인 필요", "미등록확정"]} optionLabels={["등록 확인 필요", "3개 상점 확인 · 미등록 확정"]} onChange={v => set("listingMatchStatus", v)} />}
        <Field label="번장 상품명" value={item.listing.title} onChange={v => list("title", v)} />
        <div className="form-grid"><Field label="번장 카테고리 번호 *" value={item.listing.categoryId} onChange={v => list("categoryId", v)} /><Select label="배송비" value={item.listing.shippingType} options={["포함", "별도"]} onChange={v => list("shippingType", v)} /></div>
        <label className="field"><span>상품 설명 *</span><textarea placeholder="상품 상태, 실측, 하자와 거래 안내를 입력하세요." value={item.listing.description} onChange={e => list("description", e.target.value)} /></label>
        <div className="form-grid"><Field label="태그" value={item.listing.tags.join(", ")} onChange={v => list("tags", v.split(",").map(x => x.trim()).filter(Boolean).slice(0, 5))} /><Field label="이미지 파일명 *" value={item.listing.imageNames.join(", ")} onChange={v => list("imageNames", v.split(",").map(x => x.trim()).filter(Boolean).slice(0, 12))} /></div>
      </div></section>

      <details className="extra-details"><summary><span><b>추가 상품정보</b><small>색상·모델·계절·비고 등</small></span><i>＋</i></summary><div className="extra-content form-grid">
        <Field label="상품코드" value={item.id} onChange={v => set("id", v)} /><Field label="모델명" value={item.model} onChange={v => set("model", v)} /><Field label="색상" value={item.color} onChange={v => set("color", v)} /><Select label="시즌" value={item.season} options={["겨울", "여름", "간절기", "사계절", "미입력"]} onChange={v => set("season", v)} /><Field label="판매 피크 시작월" value={item.peakFrom} type="number" onChange={v => set("peakFrom", Number(v))} /><Field label="판매 피크 종료월" value={item.peakTo} type="number" onChange={v => set("peakTo", Number(v))} /><Field label="철수 검토월" value={item.exitMonth} type="number" onChange={v => set("exitMonth", Number(v))} /><Field label="일반택배 배송비" value={item.listing.shippingFee} type="number" suffix="원" onChange={v => list("shippingFee", Number(v))} /><Select label="편의점 택배" value={item.listing.convenience} options={["둘 다 가능", "GS25", "CU", "불가능"]} onChange={v => list("convenience", v)} /><label className="field wide"><span>상품 비고</span><textarea value={item.notes} onChange={e => set("notes", e.target.value)} /></label>
      </div></details>
    </div>
    <div className="drawer-actions registration-actions"><button type="submit" className="secondary">상품정보 저장</button><button type="button" className="primary" onClick={onQueue}>번장 등록대기에 추가</button></div>
  </form></div>;
}

function PurchaseDrawer({ item, setItem, saving, onClose, onSave, onSaveNext, onEvidence, onRemoveEvidence }: { item: Item; setItem: (x: Item) => void; saving: boolean; onClose: () => void; onSave: (e: FormEvent) => void; onSaveNext: (e: ReactMouseEvent<HTMLButtonElement>) => void; onEvidence: (e: ChangeEvent<HTMLInputElement>) => void; onRemoveEvidence: (index: number) => void }) {
  const set = (key: keyof Item, value: any) => setItem({ ...item, [key]: value });
  return <div className="drawer-backdrop registration-backdrop"><form className="drawer registration-page purchase-page" onSubmit={onSave}>
    <div className="drawer-head registration-head"><div><p className="eyebrow">PURCHASE RECORD</p><h2>{item.originalId ? "매입정보·증빙" : "매입 등록"}</h2><span>저장하면 재고가 자동으로 생성돼요.</span></div><button type="button" aria-label="닫기" onClick={onClose}>×</button></div>
    <div className="registration-body">
      <section className="form-section"><div className="form-label"><b>연결 상품</b><small>{item.originalId ? "이 매입 기록과 연결된 재고예요." : "재고를 만들기 위한 최소 정보만 입력해요."}</small></div><div className="vertical-fields">
        <Field label="상품명 *" value={item.name} onChange={v => set("name", v)} />
        <div className="form-grid"><Field label="브랜드" value={item.brand} onChange={v => set("brand", v)} /><Select label="카테고리" value={item.category} options={["아우터", "상의", "하의", "신발", "가방", "액세서리", "기타 의류"]} onChange={v => set("category", v)} /><Field label="사이즈" value={item.size} onChange={v => set("size", v)} /><Select label="상품 상태" value={item.condition} options={["S", "A", "B", "C"]} onChange={v => set("condition", v)} /></div>
      </div></section>
      <section className="form-section purchase-highlight"><div className="form-label"><b>매입 정보</b><small>실제 지출 기준으로 입력해요.</small></div><div className="form-grid">
        <Field label="매입가격 *" value={item.purchasePrice} type="number" suffix="원" onChange={v => set("purchasePrice", Number(v))} /><Field label="매입일 *" value={item.acquiredDate} type="date" onChange={v => set("acquiredDate", v)} /><Select label="매입처" value={item.purchaseSource} options={["번개장터", "당근", "후르츠", "패밀리", "KREAM", "동대문", "기타"]} onChange={v => set("purchaseSource", v)} /><Select label="결제수단" value={item.purchasePayment} options={["계좌이체", "카드", "현금", "간편결제", "기타"]} onChange={v => set("purchasePayment", v)} /><Field label="매입 배송비" value={item.buyShipping} type="number" suffix="원" onChange={v => set("buyShipping", Number(v))} /><Field label="수선·세탁비" value={item.repairCost} type="number" suffix="원" onChange={v => set("repairCost", Number(v))} />
        {item.purchasePayment === "카드" && <p className="manual-payment-note wide"><b>카드 결제금액은 직접 입력</b><span>위 매입가격에 실제 카드 승인금액을 입력하면 재고원가와 카드 매입액에 반영돼요.</span></p>}
        <label className="field wide"><span>매입 메모</span><textarea placeholder="거래 상대, 묶음매입, 특이사항 등을 기록하세요." value={item.purchaseMemo} onChange={e => set("purchaseMemo", e.target.value)} /></label>
      </div></section>
      <section className="form-section"><div className="form-label"><b>매입증빙</b><small>영수증·이체내역·거래채팅·카드전표 등을 여러 장 보관할 수 있어요.</small></div><div><label className="evidence-drop"><input type="file" multiple accept="image/*,.pdf" onChange={onEvidence} /><span>＋</span><b>매입증빙 추가</b><small>이미지 또는 PDF · 파일당 8MB 이하</small></label><div className="attachment-list evidence-list">{item.attachments.map((a, idx) => <div key={`${a.name}-${idx}`}><a href={a.url || a.data} target="_blank" rel="noreferrer">{a.name}</a><span>{Math.max(1, Math.round(a.size / 1024))}KB</span><button type="button" onClick={() => onRemoveEvidence(idx)}>삭제</button></div>)}</div></div></section>
      {!!item.purchaseHistory.length && <section className="form-section"><div className="form-label"><b>매입가 변경 이력</b><small>수익 계산에 영향을 주는 변경만 기록해요.</small></div><div className="history-list">{item.purchaseHistory.map((h, index) => <div key={`${h.at}-${index}`}><span>{new Date(h.at).toLocaleString("ko-KR")}</span><b>{won(h.from)} → {won(h.to)}</b></div>)}</div></section>}
    </div>
    <div className="drawer-actions registration-actions"><button type="submit" className="primary" disabled={saving}>{saving ? "저장 중…" : item.originalId ? "매입정보 저장" : "저장하고 재고 생성"}</button>{!item.originalId && <button type="button" className="secondary" disabled={saving} onClick={onSaveNext}>저장 후 다음 매입</button>}</div>
  </form></div>;
}

function SaleDrawer({ item, setItem, onClose, onSave, onUndo, onReturn }: { item: Item; setItem: (x: Item) => void; onClose: () => void; onSave: (e: FormEvent) => void; onUndo: () => void; onReturn: () => void }) {
  const set = (key: keyof Item, value: any) => setItem({ ...item, [key]: value });
  const estimatedProfit = item.actualPrice - totalCost(item) - item.fee - item.shipping;
  return <div className="drawer-backdrop center-modal"><form className="sale-modal" onSubmit={onSave}>
    <div className="sale-modal-head"><div><span className="sale-check">✓</span><div><p className="eyebrow">{item.inventoryStatus === "판매완료" ? "SALE RECORD" : "COMPLETE SALE"}</p><h2>{item.inventoryStatus === "판매완료" ? "판매정보" : "판매완료 처리"}</h2></div></div><button type="button" aria-label="닫기" onClick={onClose}>×</button></div>
    <div className="sale-product"><div className="product-dot">{item.brand.slice(0, 1) || "?"}</div><div><b>{item.brand} {item.name}</b><span>{item.size || "사이즈 미입력"} · 원가 {won(totalCost(item))}</span></div></div>
    <div className="sale-fields form-grid"><Field label="판매일 *" value={item.saleDate} type="date" onChange={v => set("saleDate", v)} /><Field label="실판매가 *" value={item.actualPrice} type="number" suffix="원" onChange={v => set("actualPrice", Number(v))} /><Select label="판매 채널" value={item.saleChannel} options={["번개장터", "당근", "후르츠", "패밀리", "KREAM", "기타"]} onChange={v => set("saleChannel", v)} /><Select label="정산 상태" value={item.settlementStatus === "해당없음" ? "정산대기" : item.settlementStatus} options={["정산대기", "정산완료", "확인필요"]} onChange={v => set("settlementStatus", v)} /><Field label="플랫폼 수수료" value={item.fee} type="number" suffix="원" onChange={v => set("fee", Number(v))} /><Field label="판매 배송비" value={item.shipping} type="number" suffix="원" onChange={v => set("shipping", Number(v))} /></div>
    <div className="sale-result"><span>예상 순이익</span><strong className={estimatedProfit >= 0 ? "positive" : ""}>{item.actualPrice > 0 ? won(estimatedProfit) : "-"}</strong><small>판매가 − 매입원가 − 수수료 − 배송비</small></div>
    <div className="sale-modal-actions split-actions">{item.inventoryStatus === "판매완료" && <div><button type="button" className="danger-link" onClick={onUndo}>판매 취소·재고 복귀</button><button type="button" className="return-link" onClick={onReturn}>반품 처리</button></div>}<div><button type="button" className="secondary" onClick={onClose}>닫기</button><button type="submit" className="sale-confirm">{item.inventoryStatus === "판매완료" ? "판매정보 저장" : "판매완료 확정"}</button></div></div>
  </form></div>;
}

function ReturnDrawer({ item, setItem, onClose, onSave }: { item: Item; setItem: (x: Item) => void; onClose: () => void; onSave: (e: FormEvent) => void }) {
  const set = (key: keyof Item, value: any) => setItem({ ...item, [key]: value });
  return <div className="drawer-backdrop center-modal"><form className="sale-modal" onSubmit={onSave}>
    <div className="sale-modal-head"><div><span className="sale-check return">↩</span><div><p className="eyebrow">RETURN</p><h2>반품·거래취소</h2></div></div><button type="button" onClick={onClose}>×</button></div>
    <div className="sale-product"><div className="product-dot">{item.brand.slice(0, 1) || "?"}</div><div><b>{item.brand} {item.name}</b><span>판매가 {won(item.actualPrice)} · 현재 순이익 {won(profit(item))}</span></div></div>
    <div className="sale-fields form-grid"><Field label="반품일 *" value={item.returnDate} type="date" onChange={v => set("returnDate", v)} /><Select label="상품 처리 *" value={item.returnDisposition} options={["재고 복귀", "폐기·보관함"]} onChange={v => set("returnDisposition", v)} /><Field label="환불액" value={item.refundAmount} type="number" suffix="원" onChange={v => set("refundAmount", Number(v))} /><Field label="왕복·추가 배송비" value={item.returnShipping} type="number" suffix="원" onChange={v => set("returnShipping", Number(v))} /><label className="field wide"><span>반품 사유</span><textarea value={item.returnReason} onChange={e => set("returnReason", e.target.value)} /></label></div>
    <div className="sale-result"><span>반품 반영 후 매출</span><strong>{won(revenue(item))}</strong><small>환불액과 추가 배송비를 매출·순이익에서 자동 재계산합니다.</small></div>
    <div className="sale-modal-actions"><button type="button" className="secondary" onClick={onClose}>취소</button><button type="submit" className="sale-confirm">반품 확정</button></div>
  </form></div>;
}

function PublishDrawer({ item, setItem, onClose, onSave }: { item: Item; setItem: (x: Item) => void; onClose: () => void; onSave: (e: FormEvent) => void }) {
  const set = (key: keyof Item, value: any) => setItem({ ...item, [key]: value });
  return <div className="drawer-backdrop center-modal"><form className="sale-modal" onSubmit={onSave}>
    <div className="sale-modal-head"><div><span className="sale-check publish">↗</span><div><p className="eyebrow">BUNJANG</p><h2>게시 완료 기록</h2></div></div><button type="button" onClick={onClose}>×</button></div>
    <div className="sale-product"><div className="product-dot">{item.brand.slice(0, 1) || "?"}</div><div><b>{item.brand} {item.name}</b><span>번장 등록 정보를 재고와 연결해요.</span></div></div>
    <div className="sale-fields form-grid"><Field label="게시일 *" value={item.listingPublishedDate} type="date" onChange={v => set("listingPublishedDate", v)} /><Field label="게시 판매가격" value={item.listingPublishedPrice} type="number" suffix="원" onChange={v => set("listingPublishedPrice", Number(v))} /><label className="field wide"><span>게시 URL *</span><input type="url" placeholder="https://m.bunjang.co.kr/products/..." value={item.listingUrl} onChange={e => set("listingUrl", e.target.value)} /></label></div>
    <div className="sale-modal-actions"><button type="button" className="secondary" onClick={onClose}>취소</button><button type="submit" className="sale-confirm">게시정보 저장</button></div>
  </form></div>;
}
