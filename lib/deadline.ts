import { addDays, addMonths, addWeeks, addYears, differenceInCalendarDays, format, parseISO } from "date-fns";
import type { WorkingDayAdjustment } from "@/types";

export function urgency(date:string){const n=differenceInCalendarDays(parseISO(date),new Date());return n<0?"overdue":n===0?"today":n<=3?"soon":n<=7?"week":"later"}

export function parseRecurrence(rule:string):{every:number;unit:"DAY"|"WEEK"|"MONTH"|"YEAR"}|null {
  const legacy:Record<string,[number,"DAY"|"WEEK"|"MONTH"|"YEAR"]>={DAILY:[1,"DAY"],WEEKLY:[1,"WEEK"],MONTHLY:[1,"MONTH"],QUARTERLY:[3,"MONTH"],YEARLY:[1,"YEAR"]};
  if(rule==="NONE")return null;
  if(legacy[rule])return {every:legacy[rule][0],unit:legacy[rule][1]};
  const match=/^(DAYS|WEEKS|MONTHS|YEARS):([1-9]\d*)$/.exec(rule);
  if(!match)return null;
  return {every:Number(match[2]),unit:({DAYS:"DAY",WEEKS:"WEEK",MONTHS:"MONTH",YEARS:"YEAR"} as const)[match[1] as "DAYS"|"WEEKS"|"MONTHS"|"YEARS"]};
}
export function recurrenceRule(every:number,unit:"DAY"|"WEEK"|"MONTH"|"YEAR"){if(!Number.isSafeInteger(every)||every<1)throw new Error("INVALID_RECURRENCE");return `${unit}S:${every}`}
export function nextDate(date:string,rule:string){const parsed=parseRecurrence(rule);if(!parsed)return null;const d=parseISO(date);switch(parsed.unit){case "DAY":return addDays(d,parsed.every);case "WEEK":return addWeeks(d,parsed.every);case "MONTH":return addMonths(d,parsed.every);case "YEAR":return addYears(d,parsed.every)}}

function easter(year:number){const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k+7)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31),day=(h+l-7*m+114)%31+1;return new Date(year,month-1,day)}
export function isWorkday(date:Date){const day=date.getDay();if(day===0||day===6)return false;const md=format(date,"MM-dd");if(["01-01","01-06","04-25","05-01","06-02","08-15","11-01","12-08","12-25","12-26"].includes(md))return false;const e=easter(date.getFullYear());return format(date,"yyyy-MM-dd")!==format(e,"yyyy-MM-dd")&&format(date,"yyyy-MM-dd")!==format(addDays(e,1),"yyyy-MM-dd")}
export function adjustWorkday(date:Date,rule:WorkingDayAdjustment="NONE"){if(rule==="NONE")return date;let result=date;const direction=rule==="PREVIOUS_WORKDAY"?-1:1;while(!isWorkday(result))result=addDays(result,direction);return result}
export function nextOccurrence(date:string,rule:string,adjustment:WorkingDayAdjustment="NONE"){const next=nextDate(date,rule);return next?format(adjustWorkday(next,adjustment),"yyyy-MM-dd"):null}
