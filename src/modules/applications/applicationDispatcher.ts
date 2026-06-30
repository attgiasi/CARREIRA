import { AgentSettings } from "../../types.js";
import { assertApplicationAllowed } from "../../safety/policyGuard.js";

export function dispatchApplication(settings: AgentSettings): never {
  assertApplicationAllowed(settings);
  throw new Error("Envio automático não implementado por segurança. Use APIs permitidas e aprovação explícita.");
}
