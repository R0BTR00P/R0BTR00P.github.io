// 1) Paste your Supabase URL + anon key here (Project Settings -> API)
const SUPABASE_URL = "PASTE_YOUR_PROJECT_URL";
const SUPABASE_ANON_KEY = "PASTE_YOUR_ANON_PUBLIC_KEY";

// Supabase CDN exposes a global "supabase" object
const client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Simple game state ---
let state = {
  coins: 0,
  inventory: [],
};

// --- UI helpers ---
const $ = (id) => document.getElementById(id);
const authMsg = (t) => ($("authMsg").textContent = t || "");
const gameMsg = (t) => ($("gameMsg").textContent = t || "");

function render() {
  $("coins").textContent = String(state.coins);
  $("inv").textContent = state.inventory.length
    ? state.inventory.map((x, i) => `${i + 1}. ${x}`).join("\n")
    : "(empty)";
}

function showApp(isAuthed) {
  $("app").style.display = isAuthed ? "block" : "none";
  $("btnLogout").style.display = isAuthed ? "inline-block" : "none";
}

// --- Save / Load ---
async function ensureProfileRow(userId) {
  // Upsert a default row if missing
  const { error } = await client
    .from("profiles")
    .upsert({ id: userId, coins: 0, inventory: [] }, { onConflict: "id" });

  if (error) throw error;
}

async function loadGame() {
  const { data: { user }, error: uerr } = await client.auth.getUser();
  if (uerr) throw uerr;
  if (!user) return;

  await ensureProfileRow(user.id);

  const { data, error } = await client
    .from("profiles")
    .select("coins, inventory")
    .eq("id", user.id)
    .single();

  if (error) throw error;

  state.coins = Number(data.coins ?? 0);
  state.inventory = Array.isArray(data.inventory) ? data.inventory : [];
  render();
  gameMsg("Loaded save ✅");
}

async function saveGame() {
  const { data: { user }, error: uerr } = await client.auth.getUser();
  if (uerr) throw uerr;
  if (!user) return;

  const { error } = await client
    .from("profiles")
    .update({
      coins: state.coins,
      inventory: state.inventory,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) throw error;
  gameMsg("Saved ✅");
}

// --- Auth buttons ---
$("btnSignup").onclick = async () => {
  authMsg("");
  try {
    const email = $("email").value.trim();
    const password = $("password").value;

    const { error } = await client.auth.signUp({ email, password }); // :contentReference[oaicite:2]{index=2}
    if (error) throw error;

    authMsg("Signed up! If email confirmation is ON, check your inbox.");
  } catch (e) {
    authMsg(e.message || String(e));
  }
};

$("btnLogin").onclick = async () => {
  authMsg("");
  try {
    const email = $("email").value.trim();
    const password = $("password").value;

    const { error } = await client.auth.signInWithPassword({ email, password }); // :contentReference[oaicite:3]{index=3}
    if (error) throw error;

    authMsg("Logged in ✅");
  } catch (e) {
    authMsg(e.message || String(e));
  }
};

$("btnLogout").onclick = async () => {
  await client.auth.signOut();
  authMsg("Logged out.");
  showApp(false);
};

// React to login/logout
client.auth.onAuthStateChange(async (_event, session) => {
  const isAuthed = !!session?.user;
  showApp(isAuthed);

  if (isAuthed) {
    try {
      await loadGame();
    } catch (e) {
      gameMsg(e.message || String(e));
    }
  }
});

// --- Game buttons ---
$("btnGiveCoins").onclick = () => {
  state.coins += 100;
  render();
  gameMsg("Added 100 coins (test). Don’t forget to save!");
};

function rollItem() {
  // Weighted example
  const r = Math.random();
  if (r < 0.70) return "Common";
  if (r < 0.93) return "Rare";
  if (r < 0.99) return "Epic";
  return "Legendary";
}

$("btnOpenPack").onclick = async () => {
  gameMsg("");
  const cost = 25;
  if (state.coins < cost) {
    gameMsg("Not enough coins.");
    return;
  }

  state.coins -= cost;
  const item = rollItem();
  state.inventory.push(item);
  render();
  gameMsg(`You got: ${item} 🎉`);

  // Auto-save after opening (recommended)
  try {
    await saveGame();
  } catch (e) {
    gameMsg("Opened pack, but save failed: " + (e.message || String(e)));
  }
};

$("btnSave").onclick = async () => {
  gameMsg("");
  try {
    await saveGame();
  } catch (e) {
    gameMsg(e.message || String(e));
  }
};

// Initial render
render();
