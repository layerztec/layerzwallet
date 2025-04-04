import { IStorage } from '../types/IStorage';

interface Caveat {
  type: string;
  value: any;
}

export interface Permission {
  invoker: string;
  parentCapability: string;
  caveats: Caveat[];
}

export interface PermissionRequest {
  [methodName: string]: {
    [caveatName: string]: any;
  };
}

export interface RequestedPermission {
  parentCapability: string;
  date?: number;
}

const STORAGE_KEY = 'DAPP_PERMISSIONS';

/**
 * @see https://eips.ethereum.org/EIPS/eip-2255
 */
export class DappPermissions {
  private readonly _from: string = '';
  private readonly _storage: IStorage;

  constructor(from: string, storage: IStorage) {
    if (!from || !storage) {
      // failsafe
      throw new Error('Internal error: no from or storage provided');
    }

    this._from = from;
    this._storage = storage;
  }

  private async _getPermissionsForAllFroms(): Promise<Permission[]> {
    let json: Permission[] = [];
    try {
      const result = await this._storage.getItem(STORAGE_KEY);
      json = JSON.parse(result);
    } catch (_) {
      json = [];
    }

    return json;
  }

  /**
   * returns permissions array for the current `from`
   */
  async getPermissions(): Promise<Permission[]> {
    const json = await this._getPermissionsForAllFroms();

    return json.filter((p: Permission) => p.invoker === this._from);
  }

  async revokePermissions(permissionReq: PermissionRequest) {
    const json = await this._getPermissionsForAllFroms();
    const permissions = this._permissionRequestToPermissions(permissionReq);

    for (const permission of permissions) {
      await this._storage.setItem(STORAGE_KEY, JSON.stringify(json.filter((p: Permission) => !(p.invoker === this._from && p.parentCapability === permission.parentCapability))));
    }

    return null;
  }

  _permissionRequestToPermissions(request: PermissionRequest): Permission[] {
    const ret: Permission[] = [];

    for (const methodName of Object.keys(request)) {
      const caveats: any = request[methodName];
      ret.push({
        invoker: this._from,
        parentCapability: methodName,
        caveats,
      });
    }

    return ret;
  }

  /**
   * should be called when user actually approved permissions on the UI,
   * and we just need to save it
   */
  async addPermissions(newPermissionsRequest: PermissionRequest): Promise<RequestedPermission[]> {
    let existingPermissions = await this._getPermissionsForAllFroms();

    const newPermissions = this._permissionRequestToPermissions(newPermissionsRequest);
    existingPermissions = existingPermissions.concat(newPermissions);

    await this._storage.setItem(STORAGE_KEY, JSON.stringify(existingPermissions));

    const ret: RequestedPermission[] = [];
    for (const newPermission of newPermissions) {
      ret.push({
        parentCapability: newPermission.parentCapability,
        date: +new Date(),
      });
    }

    return ret;
  }
}
