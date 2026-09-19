import test from "node:test";
import assert from "node:assert/strict";
import { can } from "../lib/permissions";
import { createSeed } from "../lib/seed";

test("i quattro utenti iniziali hanno identità e permesso di gestione distinti",()=>{
  const users=createSeed().users;
  assert.equal(users.length,4);
  assert.equal(new Set(users.map(u=>u.id)).size,4);
  assert.deepEqual(new Set(users.map(u=>u.name)),new Set(["Domenico","Giuseppe","Flavio D","Flavio G"]));
  for(const user of users)assert.equal(can(user,"events.manage"),true);
});

test("permessi centrali: admin utenti, grant individuale eventi, account disattivato",()=>{
  const admin={role:"ADMIN" as const,active:true,canManageEvents:false};
  const manager={role:"MANAGER" as const,active:true,canManageEvents:false};
  const grantedViewer={role:"VIEWER" as const,active:true,canManageEvents:true};
  assert.equal(can(admin,"users.manage"),true);
  assert.equal(can(manager,"users.manage"),false);
  assert.equal(can(manager,"events.manage"),false);
  assert.equal(can(grantedViewer,"events.create"),true);
  assert.equal(can({...grantedViewer,active:false},"events.manage"),false);
});
