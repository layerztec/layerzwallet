import { Networks } from './networks';

/**
 * represents some webpage that user can go to and interact with using one of
 * bitcoin layers that we support. can be goods/services. implies that we
 * might get an affiliate commission.
 */
export interface PartnerInfo {
  readonly network: Networks;
  readonly name: string;
  readonly url: string;
  readonly imgUrl: string;
  readonly description?: string;
}
