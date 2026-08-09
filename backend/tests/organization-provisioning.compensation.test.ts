import {afterEach,describe,expect,it,vi} from 'vitest';
import {onboardOrganization,organizationPrisma} from '../organization-service/src/services/onboarding.service';

describe('organization provisioning compensation',()=>{
 afterEach(()=>vi.restoreAllMocks());
 it('provisions academic projection and auth admin, then publishes organization event',async()=>{
  vi.stubEnv('SERVICE_TOKEN_SECRET','test-service-token-secret-at-least-32-bytes');
  vi.spyOn(organizationPrisma.organization,'findUnique').mockResolvedValue(null);
  vi.spyOn(organizationPrisma.organization,'create').mockResolvedValue({id:'org-1',name:'School',slug:'school',domain:null,logoUrl:null,settings:{}} as any);
  const fetchMock=vi.spyOn(globalThis,'fetch')
   .mockResolvedValueOnce(new Response(JSON.stringify({success:true}),{status:201,headers:{'content-type':'application/json'}}))
   .mockResolvedValueOnce(new Response(JSON.stringify({success:true}),{status:201,headers:{'content-type':'application/json'}}));

  const organization=await onboardOrganization({name:'School',slug:'school',admin:{email:'admin@school.mn',password:'StrongPass123!',firstName:'Admin',lastName:'User'}});

  expect(organization).toMatchObject({id:'org-1',slug:'school'});
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(String(fetchMock.mock.calls[0][0])).toContain('/internal/organizations');
  expect(fetchMock.mock.calls[0][1]?.method).toBe('POST');
  expect(String(fetchMock.mock.calls[1][0])).toContain('/internal/organizations/org-1/admin');
  expect(fetchMock.mock.calls[1][1]?.method).toBe('POST');
 });

 it('fails fast on duplicate slug without provisioning downstream services',async()=>{
  vi.spyOn(organizationPrisma.organization,'findUnique').mockResolvedValue({id:'existing'} as any);
  const fetchMock=vi.spyOn(globalThis,'fetch');

  await expect(onboardOrganization({name:'School',slug:'school',admin:{email:'admin@school.mn',password:'StrongPass123!',firstName:'Admin',lastName:'User'}})).rejects.toThrow('Organization slug is already in use');

  expect(fetchMock).not.toHaveBeenCalled();
 });

 it('removes academic projection and organization when admin provisioning fails',async()=>{
  vi.stubEnv('SERVICE_TOKEN_SECRET','test-service-token-secret-at-least-32-bytes');
  vi.spyOn(organizationPrisma.organization,'findUnique').mockResolvedValue(null);
  vi.spyOn(organizationPrisma.organization,'create').mockResolvedValue({id:'org-1',name:'School',slug:'school',domain:null,logoUrl:null,settings:{}} as any);
  const rollback=vi.spyOn(organizationPrisma.organization,'delete').mockResolvedValue({} as any);
  const fetchMock=vi.spyOn(globalThis,'fetch')
   .mockResolvedValueOnce(new Response(JSON.stringify({success:true}),{status:201,headers:{'content-type':'application/json'}}))
   .mockResolvedValueOnce(new Response(JSON.stringify({message:'admin failed'}),{status:500,headers:{'content-type':'application/json'}}))
   .mockResolvedValueOnce(new Response(null,{status:204}));
  await expect(onboardOrganization({name:'School',slug:'school',admin:{email:'admin@school.mn',password:'StrongPass123!',firstName:'Admin',lastName:'User'}})).rejects.toThrow('admin failed');
  expect(fetchMock.mock.calls[2][1]?.method).toBe('DELETE');
  expect(String(fetchMock.mock.calls[2][0])).toContain('/internal/organizations/org-1');
  expect(rollback).toHaveBeenCalledWith({where:{id:'org-1'}});
 });
});
