export function validateState(raw: unknown): void {
  if (!raw || typeof raw !== 'object') throw new Error('원장 형식이 올바르지 않습니다.');
  const s = raw as Record<string, unknown>;
  if (!Array.isArray(s.items) || s.items.length > 10000) throw new Error('상품 목록을 확인해 주세요.');
  if (s.schemaVersion !== undefined && ![1, 2, 3, 4, 5, 6].includes(Number(s.schemaVersion))) throw new Error('지원하지 않는 데이터 버전입니다.');
  const ids = new Set<string>();
  for (const item of s.items) {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !item.id.trim() || ids.has(item.id)) throw new Error('상품코드 누락 또는 중복: 원본을 확인해 주세요.');
    ids.add(item.id);
    for (const field of ['purchasePrice','buyShipping','repairCost','expectedPrice','minimumPrice','actualPrice','fee','shipping','refundAmount','returnShipping']) {
      if (item[field] !== undefined && item[field] !== null && (typeof item[field] !== 'number' || !Number.isFinite(item[field]) || item[field] < 0)) throw new Error(`${item.id}: ${field} 금액을 확인해 주세요.`);
    }
    for (const field of ['brand','name','model','category','size','color','acquiredDate','saleDate','registeredDate','inventoryStatus','listingStatus']) if(item[field]!==undefined&&typeof item[field]!=='string')throw new Error(`${item.id}: ${field} 형식을 확인해 주세요.`);
    for (const field of ['acquiredDate','saleDate','returnDate','registeredDate']) {
      if (item[field] && !validDate(String(item[field]))) throw new Error(`${item.id}: 날짜를 확인해 주세요.`);
    }
    for (const field of ['attachments','productPhotos','purchaseHistory','dataIssues','transactionHistory','priceHistory']) {
      if (item[field] !== undefined && !Array.isArray(item[field])) throw new Error(`${item.id}: ${field} 목록을 확인해 주세요.`);
    }
    if (item.listing !== undefined && (!item.listing || typeof item.listing !== 'object' || Array.isArray(item.listing))) throw new Error(`${item.id}: 등록 정보를 확인해 주세요.`);
    if (item.listing) {
      for (const field of ['tags','imageNames']) if (item.listing[field] !== undefined && !Array.isArray(item.listing[field])) throw new Error(`${item.id}: 등록 목록을 확인해 주세요.`);
      for (const field of ['price','shippingFee','halfShipping','quantity']) if (item.listing[field] !== undefined && (!Number.isFinite(item.listing[field]) || item.listing[field] < 0)) throw new Error(`${item.id}: 등록 금액을 확인해 주세요.`);
    }
  }
  for (const key of ['accounts','debts','snapshots','marketListings','audit']) if (s[key] !== undefined && !Array.isArray(s[key])) throw new Error(`${key} 목록을 확인해 주세요.`);
  for(const key of ['accounts','debts']) {
    const records=s[key];if(!Array.isArray(records))continue;
    const recordIds=new Set<string>();
    for(const record of records){
      if(!record||typeof record.id!=='string'||!record.id||recordIds.has(record.id))throw new Error(`${key}: 코드 누락 또는 중복`);
      recordIds.add(record.id);
      for(const field of key==='accounts'?['balance']:['remaining','plannedPrincipal','interestCost']) {
        if(record[field]!==undefined&&(!Number.isFinite(record[field])||(key==='debts'&&record[field]<0)))throw new Error(`${key}: 금액을 확인해 주세요.`);
      }
      if(key==='debts'&&record.paymentHistory!==undefined&&!Array.isArray(record.paymentHistory))throw new Error('상환 기록 형식을 확인해 주세요.');
    }
  }
  if(s.settings&&typeof s.settings==='object'){
    for(const [key,value] of Object.entries(s.settings))if(typeof value==='number'&&(!Number.isFinite(value)||value<0||(key==='feeRate'&&value>=1)))throw new Error('설정 금액과 수수료율을 확인해 주세요.');
  }

}
export function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}
export function serializeState(state: unknown) {
  return JSON.stringify(state, (key, value) => key === 'url' && typeof value === 'string' && (value.includes('/storage/v1/object/sign/') || value.includes('/api/files/raw?')) ? undefined : value);
}
export const businessDate = () => new Intl.DateTimeFormat("sv-SE",{timeZone:"Asia/Seoul"}).format(new Date());
export function holdingDays(date: string, now = businessDate()): number | null {
  if (!validDate(date) || !validDate(now)) return null;
  return Math.max(0, Math.floor((Date.parse(now) - Date.parse(date)) / 86400000));
}
export function priceComparison(item: {expectedPrice:number;listing:{price:number};purchasePrice:number;buyShipping:number;repairCost:number}, next:number, feeRate:number, shipping:number) {
  const current = item.listing.price || item.expectedPrice;
  return {current, cut: current > 0 ? (current-next)/current*100 : null, margin: next*(1-feeRate)-item.purchasePrice-item.buyShipping-item.repairCost-shipping};
}
