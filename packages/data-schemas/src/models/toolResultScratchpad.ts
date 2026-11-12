import { Model } from 'mongoose';
import toolResultScratchpadSchema, {
  IToolResultScratchpad,
} from '~/schema/toolResultScratchpad';
import { applyTenantIsolation } from '~/models/plugins/tenantIsolation';

export function createToolResultScratchpadModel(
  mongoose: typeof import('mongoose'),
): Model<IToolResultScratchpad> {
  applyTenantIsolation(toolResultScratchpadSchema);
  return (
    mongoose.models.ToolResultScratchpad ||
    mongoose.model<IToolResultScratchpad>('ToolResultScratchpad', toolResultScratchpadSchema)
  );
}
