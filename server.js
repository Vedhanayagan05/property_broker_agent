import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { HindsightClient } from '@vectorize-io/hindsight-client';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.')); // serves index.html from this folder

const client = new HindsightClient({
  baseUrl: process.env.HINDSIGHT_BASE_URL,
  apiKey: process.env.HINDSIGHT_API_KEY,
});
const BANK = process.env.BANK_ID || 'property-broker';

// Create the memory bank once (ignored if it already exists)
(async () => {
  try {
    await client.createBank(BANK, {
      name: 'Property Broker Memory',
      background:
        'I am a real estate broker assistant. Customers state one requirement but their real preferences appear in rejection reasons. I track every site visit.',
    });
    console.log('Bank ready:', BANK);
  } catch (e) {
    console.log('Bank exists / skipped:', e.message);
  }
})();

// Health check (frontend badge uses this)
app.get('/api/health', (req, res) => res.json({ ok: true }));

// RETAIN: store one site visit
app.post('/api/retain', async (req, res) => {
  try {
    const { clientName, stated, property, reaction, reasons } = req.body;
    const content =
      `Site visit for customer ${clientName}. ` +
      `Customer stated requirement: ${stated}. ` +
      `Property shown: ${property}. ` +
      `Customer reaction: ${reaction}. ` +
      (reasons?.length ? `Reject reasons: ${reasons.join(', ')}.` : '');
    await client.retain(BANK, content, {
      context: `site visit - ${clientName}`,
      timestamp: new Date(),
      async: false,
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('retain error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// RECALL: fetch a customer's past visits
app.post('/api/recall', async (req, res) => {
  try {
    const { clientName } = req.body;
    const r = await client.recall(
      BANK,
      `What properties did ${clientName} visit, liked or rejected, and why?`,
      { budget: 'mid' }
    );
    res.json({ ok: true, memories: r.results.map((x) => x.text) });
  } catch (e) {
    console.error('recall error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

// REFLECT: stated vs real preference
app.post('/api/reflect', async (req, res) => {
  try {
    const { clientName, stated } = req.body;
    const a = await client.reflect(
      BANK,
      `Customer ${clientName} stated: ${stated}. Based only on their rejection reasons, ` +
        `what are their TRUE priorities? Rank them in 3-4 short lines and note how they differ from the stated requirement.`,
      { budget: 'mid', context: 'deciding which listings to show next' }
    );
    res.json({ ok: true, text: a.text });
  } catch (e) {
    console.error('reflect error:', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on http://localhost:${PORT}`));
