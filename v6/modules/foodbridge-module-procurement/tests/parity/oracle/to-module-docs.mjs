/*
  What the oracle's repositories and host fixtures are seeded with: the prototype's own documents
  (js/data/documents.js — the same function the prototype's in-page server starts from), plus the
  raw setup payload cafex answers /api/v2/multiAdmin/setup with.
*/
import { IDS } from '../../../js/data/documents.js';

export { toModuleDocs, oid, IDS, SESSION } from '../../../js/data/documents.js';

/**
 * The raw /api/v2/multiAdmin/setup payload for this user, as cafex answers it — the storefront
 * client lib's key map then narrows it (setup.mapper.js). Built from the tenant configuration.
 */
export function setupPayload(tenant, docs) {
  const loc = { _id: IDS.location, name: docs.store.name, orgId: IDS.org, status: 'ACTIVE' };
  return {
    username: tenant.username,
    role: tenant.role,
    subRole: tenant.subRole,
    multiLoc: tenant.multiLoc,
    userLoc: [loc],
    groupedLocationData: { sellerLocations: [loc], childLocations: [] },
    customerTypeList: tenant.customerTypeList,
    storefrontMenus: tenant.storefrontMenus,
    menus: [],
    orderWorkflow: tenant.orderWorkflow,
    appProp: tenant.appProp,
    staticAsset: {},
  };
}
