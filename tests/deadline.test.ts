import test from "node:test";import assert from "node:assert/strict";import { nextDate,urgency } from "../lib/deadline";import { format } from "date-fns";
test("mantiene la ricorrenza esatta ogni 28 giorni",()=>{assert.equal(format(nextDate("2026-01-31","DAYS:28")!,"yyyy-MM-dd"),"2026-02-28")});
test("distingue mensile da 28 giorni",()=>{assert.equal(format(nextDate("2026-01-31","MONTHLY")!,"yyyy-MM-dd"),"2026-02-28");assert.equal(format(nextDate("2026-02-28","DAYS:28")!,"yyyy-MM-dd"),"2026-03-28")});
test("una data passata è scaduta",()=>{assert.equal(urgency("2020-01-01"),"overdue")});
