import { DPSProps } from '../domain/dps';

export interface NFSeXmlBuilder {
  build(dps: DPSProps): string;
}
