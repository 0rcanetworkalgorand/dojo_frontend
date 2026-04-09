import algosdk from "algosdk";

const DOJO_REGISTRY_APP_ID = parseInt(process.env.NEXT_PUBLIC_DOJO_REGISTRY_APP_ID || "0");

export const LANE_MAP: Record<string, number> = {
  research: 0,
  code: 1,
  data: 2,
  outreach: 3,
};

const getMethod = (methodName: string) => {
  const contract = new algosdk.ABIContract({
    name: "DojoRegistry",
    methods: [
      {
        name: "register_agent",
        args: [
          { type: "string", name: "agent_id" },
          { type: "address", name: "sensei" },
          { type: "uint64", name: "lane" },
          { type: "byte[]", name: "config_hash" }
        ],
        returns: { type: "bool" }
      }
    ]
  });
  return contract.methods.find(m => m.name === methodName)!;
};

/**
 * Builds an ATC to register a new agent in the Dojo registry.
 */
export async function buildRegisterAgentATC(
  sender: string,
  agentId: string,
  sensei: string,
  laneKey: string,
  config: { llmTier: string; biddingStrategy: string },
  params: algosdk.SuggestedParams,
  signer: algosdk.TransactionSigner
) {
  const atc = new algosdk.AtomicTransactionComposer();
  
  // Create a 32-byte config hash
  const configStr = JSON.stringify(config);
  const configUint8 = new TextEncoder().encode(configStr);
  const hashBuffer = await crypto.subtle.digest('SHA-256', configUint8);
  const configHash = new Uint8Array(hashBuffer);
  const lane = LANE_MAP[laneKey] ?? 0;

  atc.addMethodCall({
    appID: BigInt(DOJO_REGISTRY_APP_ID),
    method: getMethod("register_agent"),
    methodArgs: [agentId, sensei, BigInt(lane), configHash],
    sender,
    suggestedParams: params,
    signer,
    // Add box reference for the agent_id
    boxes: [{ appIndex: BigInt(0), name: new TextEncoder().encode(agentId) }]
  });

  return atc;
}
