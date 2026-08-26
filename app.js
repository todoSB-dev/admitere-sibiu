const { createClient } = window.supabase;
const supabase = createClient(window.SUPABASE_URL, window.SUPABASE_PUBLISHABLE_KEY);

let mode = "login";
let currentUser = null;
let questions = [];
let currentIndex = 0;
let selectedIndex = null;
let answeredCurrent = false;

const $ = (id) => document.getElementById(id);

function setMessage(el, text, type="") {
  el.textContent = text || "";
  el.className = `message ${type}`.trim();
}

function showView(name) {
  ["practice","dashboard","mistakes"].forEach(v => $(`${v}View`).classList.toggle("hidden", v !== name));
  if (name === "dashboard") loadDashboard();
  if (name === "mistakes") loadMistakes();
}

function setAuthMode(next) {
  mode = next;
  $("loginTab").classList.toggle("active", mode === "login");
  $("signupTab").classList.toggle("active", mode === "signup");
  $("nameWrap").classList.toggle("hidden", mode === "login");
  $("authSubmit").textContent = mode === "login" ? "Intră în cont" : "Creează cont";
  setMessage($("authMessage"), "");
}

async function init() {
  $("loginTab").onclick = () => setAuthMode("login");
  $("signupTab").onclick = () => setAuthMode("signup");

  $("authForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("email").value.trim();
    const password = $("password").value;
    const fullName = $("fullName").value.trim();

    setMessage($("authMessage"), "Se procesează...");
    let result;
    if (mode === "signup") {
      result = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } }
      });
      if (result.error) return setMessage($("authMessage"), result.error.message, "error");
      if (!result.data.session) {
        return setMessage($("authMessage"), "Cont creat. Verifică emailul și apoi autentifică-te.", "success");
      }
    } else {
      result = await supabase.auth.signInWithPassword({ email, password });
      if (result.error) return setMessage($("authMessage"), result.error.message, "error");
    }
    await enterApp(result.data.user || (await supabase.auth.getUser()).data.user);
  });

  document.querySelectorAll("[data-view]").forEach(btn => {
    btn.onclick = () => showView(btn.dataset.view);
  });

  $("logoutBtn").onclick = async () => {
    await supabase.auth.signOut();
  };

  $("checkBtn").onclick = submitAnswer;
  $("nextBtn").onclick = nextQuestion;

  supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) await enterApp(session.user);
    else exitApp();
  });

  const { data } = await supabase.auth.getSession();
  if (data.session?.user) await enterApp(data.session.user);
}

async function enterApp(user) {
  if (!user) return;
  currentUser = user;
  $("authView").classList.add("hidden");
  $("appView").classList.remove("hidden");
  $("nav").classList.remove("hidden");
  await loadQuestions();
}

function exitApp() {
  currentUser = null;
  $("authView").classList.remove("hidden");
  $("appView").classList.add("hidden");
  $("nav").classList.add("hidden");
  questions = [];
  currentIndex = 0;
}

async function loadQuestions() {
  // Pentru MVP: citim întrebările publicate. Dacă vrei să testezi imediat cele 20
  // de întrebări draft, rulează politica SQL din README.
  const { data, error } = await supabase
    .from("questions")
    .select("id,text,options,correct_index,explanation,difficulty,subject_id,chapter_id,subjects(name),chapters(name)")
    .in("review_status", ["draft", "verified", "published"])
    .order("id");

  if (error) {
    return setGlobal(error.message, true);
  }

  questions = data || [];
  if (!questions.length) {
    $("questionText").textContent = "Nu există încă întrebări publicate.";
    $("questionMeta").textContent = "În MVP, întrebările sunt păstrate ca draft până sunt verificate.";
    $("options").innerHTML = "";
    $("checkBtn").disabled = true;
    $("sessionProgress").textContent = "0 / 0";
    return;
  }
  currentIndex = 0;
  renderQuestion();
}

function setGlobal(text, error=false) {
  setMessage($("globalMessage"), text, error ? "error" : "success");
}

function renderQuestion() {
  const q = questions[currentIndex];
  selectedIndex = null;
  answeredCurrent = false;
  $("feedback").className = "feedback hidden";
  $("feedback").textContent = "";
  $("checkBtn").classList.remove("hidden");
  $("checkBtn").disabled = true;
  $("nextBtn").classList.add("hidden");
  $("sessionProgress").textContent = `${currentIndex + 1} / ${questions.length}`;
  $("questionMeta").textContent = `${q.subjects?.name || ""} • ${q.chapters?.name || ""} • ${q.difficulty}`;
  $("questionText").textContent = q.text;

  let opts = q.options;
  if (typeof opts === "string") {
    try { opts = JSON.parse(opts); } catch { opts = []; }
  }
  $("options").innerHTML = (opts || []).map((opt, i) =>
    `<button class="option" data-index="${i}"><span class="letter">${String.fromCharCode(65+i)}.</span><span>${escapeHtml(opt)}</span></button>`
  ).join("");

  document.querySelectorAll(".option").forEach(btn => {
    btn.onclick = () => {
      if (answeredCurrent) return;
      selectedIndex = Number(btn.dataset.index);
      document.querySelectorAll(".option").forEach(x => x.classList.remove("selected"));
      btn.classList.add("selected");
      $("checkBtn").disabled = false;
    };
  });
}

async function submitAnswer() {
  if (selectedIndex === null || answeredCurrent) return;
  const q = questions[currentIndex];
  const correct = selectedIndex === q.correct_index;
  answeredCurrent = true;

  document.querySelectorAll(".option").forEach((btn, i) => {
    if (i === q.correct_index) btn.classList.add("correct");
    if (i === selectedIndex && !correct) btn.classList.add("incorrect");
  });

  $("checkBtn").classList.add("hidden");
  $("nextBtn").classList.remove("hidden");
  const feedback = $("feedback");
  feedback.className = `feedback ${correct ? "good" : "bad"}`;
  feedback.innerHTML = `<strong>${correct ? "Corect!" : "Greșit."}</strong><br>${escapeHtml(q.explanation)}`;

  const { error } = await supabase.from("answers").insert({
    user_id: currentUser.id,
    question_id: q.id,
    selected_index: selectedIndex,
    is_correct: correct
  });
  if (error) setGlobal(`Răspunsul nu s-a putut salva: ${error.message}`, true);
}

function nextQuestion() {
  currentIndex = (currentIndex + 1) % questions.length;
  renderQuestion();
}

async function loadDashboard() {
  if (!currentUser) return;
  const { data, error } = await supabase
    .from("answers")
    .select("is_correct")
    .eq("user_id", currentUser.id);

  if (error) return setGlobal(error.message, true);
  const answered = data?.length || 0;
  const correct = data?.filter(x => x.is_correct).length || 0;
  const accuracy = answered ? Math.round(correct / answered * 100) : 0;
  $("statAnswered").textContent = answered;
  $("statCorrect").textContent = correct;
  $("statAccuracy").textContent = `${accuracy}%`;
  $("dashboardHint").textContent =
    answered === 0 ? "Începe cu 10–20 de grile și urmărește-ți precizia." :
    accuracy >= 85 ? "Foarte bine. Poți crește dificultatea și trece la simulări." :
    accuracy >= 70 ? "Bun început. Reia întrebările greșite și lucrează pe capitole." :
    "Concentrează-te pe explicațiile întrebărilor greșite înainte de o nouă simulare.";
}

async function loadMistakes() {
  if (!currentUser) return;
  const { data, error } = await supabase
    .from("answers")
    .select("id,selected_index,answered_at,questions(id,text,options,correct_index,explanation,difficulty,subjects(name),chapters(name))")
    .eq("user_id", currentUser.id)
    .eq("is_correct", false)
    .order("answered_at", { ascending: false })
    .limit(50);

  if (error) return setGlobal(error.message, true);
  const list = $("mistakesList");
  if (!data?.length) {
    list.innerHTML = `<div class="card mistake"><h3>Încă nu ai greșeli salvate.</h3><p class="muted">Rezolvă câteva grile și aici vor apărea automat.</p></div>`;
    return;
  }

  list.innerHTML = data.map(row => {
    const q = row.questions;
    let opts = q?.options;
    if (typeof opts === "string") { try { opts = JSON.parse(opts); } catch {} }
    const chosen = opts?.[row.selected_index] ?? "—";
    const correct = opts?.[q.correct_index] ?? "—";
    return `<div class="card mistake">
      <div><span class="tag">${escapeHtml(q?.subjects?.name || "")}</span><span class="tag">${escapeHtml(q?.difficulty || "")}</span></div>
      <h3>${escapeHtml(q?.text || "")}</h3>
      <p><strong>Ai ales:</strong> ${escapeHtml(chosen)}</p>
      <p><strong>Corect:</strong> ${escapeHtml(correct)}</p>
      <p><strong>Explicație:</strong> ${escapeHtml(q?.explanation || "")}</p>
    </div>`;
  }).join("");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[ch]));
}

init();
