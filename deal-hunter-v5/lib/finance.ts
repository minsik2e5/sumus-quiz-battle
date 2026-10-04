import {validDate} from './state.ts';
type Event=Record<string,unknown>;
type FinancialItem={id:string;acquiredDate:string;purchasePrice:number;buyShipping:number;repairCost:number;inventoryStatus:string;saleDate:string;actualPrice:number;fee:number;shipping:number;refundAmount:number;returnShipping:number;returnDate:string;returnDisposition:string;saleTransactionId:string;transactionHistory?:Event[]};
export type Month={revenue:number;profit:number;count:number;purchases:number;purchaseCount:number;interest:number;inventory:number;unknownProfit:number;refunds:number};
const cost=(i:FinancialItem)=>i.purchasePrice+i.buyShipping+i.repairCost;
export function buildMonthlyLedger(items:FinancialItem[],debts:{lastPaidDate:string;interestCost:number;paymentHistory?:{date:string;interest:number;cancelled:boolean}[]}[],now:string) {
  const map=new Map<string,Month>();
  const row=(date:string)=>{const m=date.slice(0,7);if(!map.has(m))map.set(m,{revenue:0,profit:0,count:0,purchases:0,purchaseCount:0,interest:0,inventory:0,unknownProfit:0,refunds:0});return map.get(m)!;};
  const records=new Map<string,{item:FinancialItem;event:Event}>();
  for(const item of items){
    if(validDate(item.acquiredDate)){const r=row(item.acquiredDate);r.purchases+=cost(item);r.purchaseCount++;}
    for(const event of item.transactionHistory||[]) records.set(`${item.id}:${event.saleTransactionId||`${event.saleDate}:${event.actualPrice}`}`,{item,event});
    if(item.saleDate) {
      const key=`${item.id}:${item.saleTransactionId||`${item.saleDate}:${item.actualPrice}`}`;
      // A current returned transaction can enrich its archived version, but a cancelled event stays cancelled.
      if(records.get(key)?.event.action!=='판매 취소')records.set(key,{item,event:{...item,action:item.returnDate?'반품':'판매'}});
    }
  }
  for(const {item,event} of records.values()){
    if(event.action==='판매 취소')continue;
    const saleDate=String(event.saleDate||''),amount=Number(event.actualPrice)||0;
    if(!validDate(saleDate)||amount<=0)continue;
    const c=event.purchasePrice!==undefined?Number(event.purchasePrice)+Number(event.buyShipping||0)+Number(event.repairCost||0):cost(item);
    const r=row(saleDate);r.revenue+=amount;r.count++;
    if(c>0)r.profit+=amount-c-Number(event.fee||0)-Number(event.shipping||0);else r.unknownProfit++;
    const returnDate=String(event.returnDate||'');
    if(validDate(returnDate)){
      const refund=Number(event.refundAmount||0),ret=row(returnDate);
      ret.revenue-=refund;ret.refunds+=refund;
      if(c>0)ret.profit-=refund+Number(event.returnShipping||0)-(event.returnDisposition==='재고 복귀'?c:0);
      else ret.unknownProfit++;
    }
  }
  for(const debt of debts){const events=debt.paymentHistory?.length?debt.paymentHistory.filter(p=>!p.cancelled):[{date:debt.lastPaidDate,interest:debt.interestCost}];for(const payment of events)if(validDate(payment.date)){const r=row(payment.date);r.interest+=payment.interest;r.profit-=payment.interest;}}
  const cursor=new Date(`${now.slice(0,7)}-01T00:00:00Z`),months:[string,Month][]=[];
  for(let offset=17;offset>=0;offset--){
    const date=new Date(Date.UTC(cursor.getUTCFullYear(),cursor.getUTCMonth()-offset,1)),m=date.toISOString().slice(0,7),end=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).toISOString().slice(0,10),r=row(`${m}-01`);
    r.inventory=items.filter(i=>validDate(i.acquiredDate)&&i.acquiredDate<=end).reduce((sum,i)=>{
      const transactions=[...records.values()].filter(x=>x.item.id===i.id).map(x=>x.event).filter(e=>e.action!=='판매 취소'&&validDate(String(e.saleDate||''))&&String(e.saleDate)<=end);
      const latest=transactions.sort((a,b)=>String(b.saleDate).localeCompare(String(a.saleDate)))[0];
      const inStock=!latest||(validDate(String(latest.returnDate||''))&&String(latest.returnDate)<=end&&latest.returnDisposition==='재고 복귀');
      if(!latest&&i.inventoryStatus==='판매완료'&&!i.saleDate)return sum;
      return sum+(inStock?cost(i):0);
    },0);
    months.push([m,r]);
  }
  return months;
}
