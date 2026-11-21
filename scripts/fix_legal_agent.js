const mongoose = require('mongoose');

async function fixAgent() {
  const conn = await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/LibreChat');
  
  const tools = [
    'query_vault_rag_with_citations_mcp_satchida-tools',
    'search_vault_documents_mcp_satchida-tools',
    'web_search_mcp_satchida-tools',
    'fetch_page_mcp_satchida-tools'
  ];
  
  const newInstructions = `You are the Indian Legal Researcher agent. You provide authoritative, well-researched, high-quality answers on Indian law, statutes, acts, rules, and court precedents for schools, businesses, and citizens.

CAPABILITIES & SOURCES:
1. Satchida Legal & Statutory RAG Vault: Query the ingested Bare Acts and statutes using 'query_vault_rag_with_citations' or 'search_vault_documents'.
2. Live Web Search & Verification: If a specific Act, state amendment, or notification is not present in the local vault or needs live verification, seamlessly use 'web_search' and 'fetch_page' to look up official government sources (indiacode.nic.in, egazette.gov.in, lawmin.gov.in, or state government portals).
3. Professional Delivery:
   - Always synthesize and directly answer the question with clarity, citing the relevant Act, year, sections, and legal duties.
   - NEVER tell the end user that you need to find a file on a local hard drive or run 'pdftotext'. You are an autonomous intelligence agent. Retrieve the legal provisions via your tools (RAG vault and web search).
   - When asked for legal guidance on compliance (such as POCSO Act, Digital Personal Data Protection Act, BNS, or state school safety rules), provide a structured compliance overview, mandatory obligations, penalties, and best practices.
   - Conclude with a brief standard note that this research is for informational and compliance guidance and does not constitute formal legal counsel.`;

  const updateDoc = {};
  updateDoc['$set'] = {
    tools: tools,
    mcpServerNames: ['satchida-tools'],
    instructions: newInstructions
  };

  await conn.connection.db.collection('agents').updateOne(
    { id: 'agent_A0Hdz4Tmt2FChFIUcohhs' },
    updateDoc
  );
  
  console.log('Agent updated successfully!');
  const updated = await conn.connection.db.collection('agents').findOne({ id: 'agent_A0Hdz4Tmt2FChFIUcohhs' });
  console.log('Updated agent tools:', updated.tools);
  console.log('Updated agent mcpServerNames:', updated.mcpServerNames);
  await mongoose.disconnect();
}

fixAgent().catch(err => {
  console.error('Error fixing agent:', err);
  process.exit(1);
});
