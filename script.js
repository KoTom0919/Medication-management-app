
"use strict";

const STORAGE_KEY = "clinicAppDataV1";
const $ = id => document.getElementById(id);

const escapeHTML = value => String(value ?? "").replace(
  /[&<>"']/g,
  c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]
);

const createId = () =>
  globalThis.crypto?.randomUUID?.() ||
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const today = () => {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0")
  ].join("-");
};

const unique = values => [
  ...new Set(
    values.map(v => String(v ?? "").trim()).filter(Boolean)
  )
];

function formatDateTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value ?? "")
    : date.toLocaleString("ja-JP");
}

/* ========================================
   データの読み込み・保存
======================================== */

function loadData() {
  try {
    const raw = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "{}"
    );

    return {
      ...raw,
      drugs: Array.isArray(raw.drugs) ? raw.drugs : [],
      history: Array.isArray(raw.history) ? raw.history : [],
      memos: Array.isArray(raw.memos) ? raw.memos : []
    };
  } catch (error) {
    console.error(error);
    return { drugs: [], history: [], memos: [] };
  }
}

let data = loadData();

function saveData() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(data)
    );
    return true;
  } catch (error) {
    console.error(error);
    alert("データの保存に失敗しました。");
    return false;
  }
}

/* ========================================
   薬剤データの共通処理
======================================== */

function normalizedTimings(drug) {
  if (Array.isArray(drug.timings)) {
    return unique(drug.timings);
  }

  return unique(
    typeof drug.timing === "string"
      ? [drug.timing]
      : []
  );
}

function isPrn(drug) {
  return (
    drug.type === "prn" ||
    drug.drugType === "prn" ||
    (
      !!drug.prnTiming &&
      normalizedTimings(drug).length === 0
    )
  );
}

function initialRemaining(drug) {
  if (isPrn(drug)) {
    return Math.max(
      0,
      Number(drug.prnCount) || 0
    );
  }

  const days = Number(drug.prescriptionDays) || 0;
  const times = normalizedTimings(drug).length;

  return Math.max(0, days * times);
}

function migrateDrugs() {
  let changed = false;

  for (const drug of data.drugs) {
    if (!drug.id) {
      drug.id = createId();
      changed = true;
    }

    if (!drug.type) {
      drug.type = isPrn(drug)
        ? "prn"
        : "regular";
      changed = true;
    }

    if (!Array.isArray(drug.timings)) {
      drug.timings = normalizedTimings(drug);
      changed = true;
    }

    if (
      drug.remaining === undefined ||
      drug.remaining === null ||
      drug.remaining === ""
    ) {
      drug.remaining = initialRemaining(drug);
      changed = true;
    }

    if (
      Number(drug.remaining) === 0 &&
      !drug.isPast
    ) {
      drug.isPast = true;
      changed = true;
    }
  }

  if (changed) saveData();
}

migrateDrugs();

/* ========================================
   ページ切り替え
======================================== */

function showPage(pageId) {
  document.querySelectorAll(".page").forEach(page => {
    page.classList.toggle(
      "active",
      page.id === pageId
    );
  });

  if (pageId === "home") { renderSlots(); renderTokenUI(); }
  if (pageId === "quiz") { if (!data.token.enabled) {showPage("home");return;} renderTokenUI(); }
  if (pageId === "drugs") renderDrugs();
  if (pageId === "history") renderHistory();
  if (pageId === "settings") renderSettings();
  if (pageId === "memos") renderMemos();

  window.scrollTo(0, 0);
}

/* ========================================
   時計
======================================== */


/* ========================================
   グラスモーフィズム時計
======================================== */

function updateClock() {
  const now = new Date();

  const weekdays = [
    "日曜日", "月曜日", "火曜日",
    "水曜日", "木曜日", "金曜日", "土曜日"
  ];

  const pad = (number) =>
    String(number).padStart(2, "0");

  const hours = pad(now.getHours());
  const minutes = pad(now.getMinutes());
  const seconds = pad(now.getSeconds());

  const weekday = weekdays[now.getDay()];

  const dateText =
    `${now.getFullYear()}年` +
    `${now.getMonth() + 1}月` +
    `${now.getDate()}日（${weekday[0]}）`;

  const weekdayElement =
    document.getElementById("clockWeekday");

  const timeElement =
    document.getElementById("clockHourMinute");

  const secondsElement =
    document.getElementById("clockSeconds");

  const dateElement =
    document.getElementById("clockDate");

  if (weekdayElement) {
    weekdayElement.textContent = weekday;
  }

  if (timeElement) {
    timeElement.textContent =
      `${hours}:${minutes}`;
  }

  if (secondsElement) {
    secondsElement.textContent = `:${seconds}`;
  }

  if (dateElement) {
    dateElement.textContent = dateText;
  }
}

/* ========================================

   薬がなくなる日の計算
======================================== */

function getEndDate(prescribed, days) {
  if (
    !prescribed ||
    !Number.isInteger(Number(days)) ||
    Number(days) <= 0
  ) {
    return "";
  }

  const [y, m, d] = prescribed
    .split("-")
    .map(Number);

  if (!y || !m || !d) return "";

  const date = new Date(y, m - 1, d);

  date.setDate(
    date.getDate() + Number(days)
  );

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function calculateEndDate() {
  // 処方日と終了日は登録確認画面で計算・表示します。
}

/* ========================================
   定期薬の服薬タイミング
======================================== */

function createTimingInput(
  value = "",
  target = $("timingFields")
) {
  const row = document.createElement("div");
  row.className = "timing-field";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "timing-input";
  input.placeholder = "例：朝後";
  input.value = value;

  input.addEventListener("input", () => {
    if (target === $("timingFields")) {
      calculateInitialRemaining();
    }
  });

  const remove = document.createElement("button");
  remove.type = "button";
  remove.textContent = "削除";

  remove.onclick = () => {
    row.remove();

    if (target === $("timingFields")) {
      calculateInitialRemaining();
    }
  };

  row.append(input, remove);
  target.append(row);

  return row;
}

function addTimingField(value = "") {
  createTimingInput(value);
  calculateInitialRemaining();
}

function setTimingFields(values = []) {
  $("timingFields").replaceChildren();

  const items = values.length
    ? values
    : [""];

  items.forEach(value => {
    createTimingInput(value);
  });
}

function readTimingFields(
  container = $("timingFields")
) {
  return unique(
    [...container.querySelectorAll(".timing-input")]
      .map(input => input.value)
  );
}

/* ========================================
   残数の自動計算
======================================== */

let remainingManuallyEdited = false;

function calculateInitialRemaining(force = false) {
  const type = $("drugType").value;

  let calculated = 0;

  if (type === "prn") {
    calculated = Math.max(
      0,
      Number($("prnCount").value) || 0
    );
  } else {
    const days =
      Number($("prescriptionDays").value) || 0;

    const times = readTimingFields().length;

    calculated = Math.max(
      0,
      days * times
    );
  }

  if (force || !remainingManuallyEdited) {
    $("remaining").value = calculated;
    remainingManuallyEdited = false;
  }

  return calculated;
}

/* ========================================
   定期薬・頓服薬の切り替え
======================================== */

function updateDrugTypeFields() {
  const prn = $("drugType").value === "prn";

  $("regularFields").hidden = prn;
  $("prnFields").hidden = !prn;

  calculateEndDate();
  calculateInitialRemaining();
}

/* ========================================
   薬剤登録フォーム
======================================== */

let selectedDrugImage = null;
let ocrWorker = null;
let batchDraft = [];

function resetDrugForm() {
  $("drugForm").reset();

  $("drugId").value = "";
  $("drugType").value = "regular";
  $("isPast").checked = false;

  setTimingFields();

  remainingManuallyEdited = false;
  updateDrugTypeFields();

  $("drugImage").value = "";
  $("preview").hidden = true;
  $("ocrStatus").textContent = "";
  $("ocrResults").hidden = true;
  $("ocrText").value = "";
  $("ocrDrugList").replaceChildren();

  cancelBatchRegistration();

  selectedDrugImage = null;
}

function openNewDrugForm() {
  resetDrugForm();
  showPage("drugform");
}

function readDrugForm() {
  const type = $("drugType").value;

  const days =
    type === "regular" &&
    $("prescriptionDays").value !== ""
      ? Number($("prescriptionDays").value)
      : null;

  const prnCount =
    type === "prn" &&
    $("prnCount").value !== ""
      ? Number($("prnCount").value)
      : null;

  const remaining =
    $("remaining").value === ""
      ? calculateInitialRemaining()
      : Number($("remaining").value);

  return {
    name: $("drugName").value.trim(),
    strength: $("strength").value.trim(),
    type,

    total:
      type === "regular"
        ? $("total").value.trim()
        : "",

    prescriptionDays: days,
    prnCount,

    timings:
      type === "regular"
        ? readTimingFields()
        : [],

    prnTiming:
      type === "prn"
        ? $("prnTiming").value.trim()
        : "",

    prescribed: "",
    endDate: "",

    remaining,

    isPast:
      $("isPast").checked ||
      remaining === 0
  };
}

function validDrug(drug) {
  if (!drug.name || !drug.strength) {
    return "薬剤名と規格を入力してください。";
  }

  if (
    !Number.isInteger(drug.remaining) ||
    drug.remaining < 0

  ) {
    return "残数は0以上の整数で入力してください。";
  }

  if (
    drug.type === "prn" &&
    drug.prnCount !== null &&
    (
      !Number.isInteger(drug.prnCount) ||
      drug.prnCount < 0
    )
  ) {
    return "頓服の処方数を確認してください。";
  }

  if (
    drug.type === "regular" &&
    drug.prescriptionDays !== null &&
    (
      !Number.isInteger(drug.prescriptionDays) ||
      drug.prescriptionDays < 1
    )
  ) {
    return "処方日数を確認してください。";
  }

  return "";
}

function saveDrug(event) {
  event.preventDefault();

  const drug = readDrugForm();
  const error = validDrug(drug);

  if (error) {
    alert(error);
    return;
  }

  openPrescriptionDateDialog([drug], "manual");
}

function editDrug(id) {
  const drug = data.drugs.find(
    item => item.id === id
  );

  if (!drug) return;

  resetDrugForm();

  $("drugId").value = drug.id;
  $("drugName").value = drug.name || "";
  $("strength").value = drug.strength || "";

  $("drugType").value =
    isPrn(drug) ? "prn" : "regular";

  $("total").value = drug.total ?? "";

  $("prescriptionDays").value =
    drug.prescriptionDays ?? "";

  $("prnCount").value =
    drug.prnCount ?? "";

  $("prnTiming").value =
    drug.prnTiming ?? "";

  setTimingFields(
    normalizedTimings(drug)
  );

  $("isPast").checked = !!drug.isPast;

  remainingManuallyEdited = true;

  $("remaining").value =
    Number(drug.remaining) || 0;

  updateDrugTypeFields();
  showPage("drugform");
}

/* ========================================
   お薬の完全削除
======================================== */

function deleteDrug(id) {
  const drug = data.drugs.find(
    item => String(item.id) === String(id)
  );

  if (!drug) return;

  const message =
    `「${drug.name}」を削除しますか？\n\n` +
    "削除したお薬は、現在のお薬にも" +
    "過去のお薬にも表示されません。";

  if (!confirm(message)) return;

  const previousDrugs = data.drugs;

  // データから完全に取り除く
  data.drugs = data.drugs.filter(
    item => String(item.id) !== String(id)
  );

  if (!saveData()) {
    data.drugs = previousDrugs;
    return;
  }

  renderDrugs();
  renderSlots();
}

/* ========================================
   現在のお薬・過去のお薬の切り替え
======================================== */

let drugListMode = "current";

function switchDrugList(mode) {
  drugListMode = mode === "past"
    ? "past"
    : "current";

  renderDrugs();
}


/* ========================================
   過去のお薬にする・現役に戻す
======================================== */

function toggleDrugPast(id) {
  const drug = data.drugs.find(
    item => String(item.id) === String(id)
  );

  if (!drug) return;

  const remaining = Number(drug.remaining) || 0;

  const isPast =
    !!drug.isPast ||
    !!drug.manuallyPast ||
    remaining <= 0;

  const nextPast = !isPast;

  // 残数0の薬は現役に戻せない
  if (!nextPast && remaining <= 0) {
    alert(
      "残数が0のお薬は現役に戻せません。\n" +
      "編集画面で残数を変更してください。"
    );
    return;
  }

  const message = nextPast
    ? `「${drug.name}」を過去のお薬にしますか？\n残数は変更されません。`
    : `「${drug.name}」を現役のお薬に戻しますか？`;

  if (!confirm(message)) return;

  const previousPast = drug.isPast;
  const previousManual = drug.manuallyPast;

  drug.isPast = nextPast;
  drug.manuallyPast = nextPast;

  if (!saveData()) {
    drug.isPast = previousPast;
    drug.manuallyPast = previousManual;
    return;
  }

  renderDrugs();
  renderSlots();
}

/* ========================================
   お薬一覧の表示
======================================== */

function clearDrugSearch() {
  $("drugSearchForm")?.reset();
  renderDrugs();
}

function renderDrugs() {
  const root = $("drugRows");

  if (!root) return;

  const showPast = drugListMode === "past";

  const currentButton = $("currentDrugsButton");
  const pastButton = $("pastDrugsButton");
  const heading = $("drugListHeading");

  // 現在のお薬ボタン
  if (currentButton) {
    currentButton.classList.toggle(
      "selected",
      !showPast
    );

    currentButton.setAttribute(
      "aria-pressed",
      String(!showPast)
    );
  }

  // 過去のお薬ボタン
  if (pastButton) {
    pastButton.classList.toggle(
      "selected",
      showPast
    );

    pastButton.setAttribute(
      "aria-pressed",
      String(showPast)
    );
  }

  // 見出し
  if (heading) {
    heading.textContent = showPast
      ? "過去のお薬を確認する"
      : "現在のお薬を確認する";
  }

  // 現在のお薬と過去のお薬を完全に分離
  const drugs = data.drugs.filter(drug => {
    const remaining = Number(drug.remaining) || 0;

    const isPast =
      !!drug.isPast ||
      !!drug.manuallyPast ||
      remaining <= 0;

    if (showPast) {
      
      return isPast;
    }

    return !isPast;
  });

  // 処方日と薬剤名で絞り込み（現在／過去の区分は維持）
  const start = $("drugSearchStart")?.value || "";
  const end = $("drugSearchEnd")?.value || "";
  const query = ($("drugSearchName")?.value || "").trim().toLocaleLowerCase("ja-JP");
  const filteredDrugs = drugs.filter(drug => {
    const prescribed = String(drug.prescribed || "").slice(0, 10);
    const name = String(drug.name || "").toLocaleLowerCase("ja-JP");
    return (!start || (prescribed && prescribed >= start)) &&
      (!end || (prescribed && prescribed <= end)) &&
      (!query || name.includes(query));
  });

  const count = $("drugSearchCount");
  if (count) count.textContent = `${filteredDrugs.length}件表示 / 全${drugs.length}件`;

  // 表を初期化
  root.replaceChildren();

  // 対象のお薬がない場合
  if (filteredDrugs.length === 0) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");

    cell.colSpan = 11;

    cell.textContent = drugs.length === 0
      ? (showPast ? "過去のお薬はありません。" : "現在のお薬はありません。")
      : "検索条件に一致するお薬はありません。";

    row.appendChild(cell);
    root.appendChild(row);

    return;
  }

  // セル作成
  function createCell(value) {
    const cell = document.createElement("td");
    cell.textContent = value ?? "";
    return cell;
  }

  // お薬を1件ずつ表示
  filteredDrugs.forEach(drug => {
    const row = document.createElement("tr");

    const remaining = Number(drug.remaining) || 0;

    const isPast =
      !!drug.isPast ||
      !!drug.manuallyPast ||
      remaining <= 0;

    const prn = isPrn(drug);

    // 薬剤名：日経メディカルへのリンク
    const nameCell = document.createElement("td");
    const nameLink = document.createElement("a");

    nameLink.textContent = drug.name || "薬剤名なし";

    const drugName = String(drug.name || "").trim();
    const company = String(drug.company || "").trim();
    const strength = String(drug.strength || "").trim();

    const searchTerms = [
      drugName,
      strength,
      company,
      "site:medical.nikkeibp.co.jp"
    ].filter(Boolean).join(" ");

    nameLink.href =
      "https://www.google.com/search?q=" +
      encodeURIComponent(searchTerms);

    nameLink.target = "_blank";
    nameLink.rel = "noopener noreferrer";
    nameLink.className = "drug-detail-link";

    nameLink.title =
      `${drug.name || "薬剤"}の情報を日経メディカルで調べる`;

    nameCell.appendChild(nameLink);
    row.appendChild(nameCell);

    // 規格
    row.appendChild(
      createCell(drug.strength || "")
    );

    // 種類
    const typeCell = createCell(
      prn ? "頓服薬" : "定期薬"
    );

    if (isPast) {
      const label = document.createElement("div");

      label.textContent = "過去のお薬";
      label.style.color = "#b83b3b";
      label.style.fontWeight = "bold";
      label.style.fontSize = "12px";

      typeCell.appendChild(label);
    }

    row.appendChild(typeCell);

    // 処方数量
    row.appendChild(
      createCell(prn ? "" : (drug.total ?? ""))
    );

    // 処方日数
    row.appendChild(
      createCell(
        prn ? "" : (drug.prescriptionDays ?? "")
      )
    );

    // 頓服の処方数
    row.appendChild(
      createCell(
        prn ? (drug.prnCount ?? "") : ""
      )
    );

    // 服薬タイミング
    let timing = "";

    if (prn) {
      timing = drug.prnTiming || "";
    } else {
      timing = normalizedTimings(drug).join("・");
    }

    row.appendChild(createCell(timing));

    // 処方日
    row.appendChild(
      createCell(drug.prescribed || "")
    );

    // 薬がなくなる日
    row.appendChild(
      createCell(prn ? "" : (drug.endDate || ""))
    );

    // 残数
    const remainingCell = createCell(remaining);

    if (remaining <= 3) {
      remainingCell.classList.add("low-remaining");
    }

    row.appendChild(remainingCell);

    // 操作ボタン
    const actionsCell = document.createElement("td");

    // 編集
    const editButton = document.createElement("button");

    editButton.type = "button";
    editButton.textContent = "編集";
    editButton.dataset.edit = String(drug.id);

    editButton.onclick = () => {
      editDrug(drug.id);
    };

    actionsCell.appendChild(editButton);

    // 過去のお薬にする・現役に戻す
    const pastActionButton =
      document.createElement("button");

    pastActionButton.type = "button";
    pastActionButton.className = "drug-past-button";

    pastActionButton.textContent = isPast
      ? "現役に戻す"
      : "過去のお薬にする";

    pastActionButton.onclick = () => {
      toggleDrugPast(drug.id);
    };

    actionsCell.appendChild(pastActionButton);

    // 削除
    const deleteButton = document.createElement("button");

    deleteButton.type = "button";
    deleteButton.textContent = "削除";
    deleteButton.dataset.delete = String(drug.id);

    deleteButton.onclick = () => {
      deleteDrug(drug.id);
    };

    actionsCell.appendChild(deleteButton);

    row.appendChild(actionsCell);
    root.appendChild(row);
  });
}

/* ========================================
   OCR画像
======================================== */

function previewImage(input) {
  const file = input.files?.[0];

  selectedDrugImage = file || null;

  if (!file) {
    $("preview").hidden = true;
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    $("preview").src = reader.result;
    $("preview").hidden = false;
  };

  reader.readAsDataURL(file);
}

async function recognizeDrugImage() {
  if (!selectedDrugImage) {
    alert("画像を選択してください。");
    return;
  }

  if (typeof Tesseract === "undefined") {
    alert(
      "OCRライブラリを読み込めませんでした。"
    );
    return;
  }

  $("ocrButton").disabled = true;

  $("ocrStatus").textContent =
    "日本語OCRを実行しています…";
    
  try {
    if (!ocrWorker) {
      ocrWorker =
        await Tesseract.createWorker("jpn");
    }

    const result =
      await ocrWorker.recognize(
        selectedDrugImage
      );

    $("ocrText").value =
      result.data.text.trim();

    $("ocrResults").hidden = false;

    updateOCRLines();

    $("ocrStatus").textContent =
      "読み取りが完了しました。内容を確認してください。";
  } catch (error) {
    console.error(error);

    $("ocrStatus").textContent =
      "読み取りに失敗しました。";
  } finally {
    $("ocrButton").disabled = false;
  }
}

/* ========================================
   OCRテキストの正規化・分割
======================================== */

function normalizeOCR(text) {
  return String(text ?? "")
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/：/g, ":")
    .trim();
}

function getOCRBlocks() {
  const lines = $("ocrText")
    .value
    .split(/\r?\n/)
    .map(normalizeOCR)
    .filter(Boolean);

  const blocks = [];
  let current = null;

  // 薬剤ブロックの開始判定
  const strengthRE =
    /\d[\d.\s]*(?:mg|μg|mcg|g)(?![a-z])/i;

  const quantityRE =
    /(?:内\s*服|屯\s*服|頓\s*服)\s*[/／]\s*調\s*剤\s*数\s*量\s*:/;

  for (const line of lines) {
    const isStart =
      strengthRE.test(line) &&
      !quantityRE.test(line);

    if (isStart) {
      if (current) {
        blocks.push(current.join("\n"));
      }

      current = [line];
    } else if (current) {
      current.push(line);
    }
  }

  if (current) {
    blocks.push(current.join("\n"));
  }

  // 半角スペースを削除
  const normalizedBlocks = blocks.map(block =>
    block.replace(/ /g, "").trim()
  );

  // 服薬タイミングの開始キーワード
  const regularStartRE = /[起朝昼食夕寝]/;

  // 頓服薬の服薬タイミングの終端文字
  const prnEndRE = /時/;

  return normalizedBlocks.filter(block => {
    // 調剤数量の項目以降を抽出する
    const quantityMatch = block.match(
      /(?:内服|屯服|頓服)[/／]調剤数量:/
    );

    if (!quantityMatch) {
      return false;
    }

    const afterQuantity = block.slice(
      quantityMatch.index +
      quantityMatch[0].length
    );

    // 定期薬は「日分」より後ろを判定
    const daysMatch = afterQuantity.match(
      /\d+日分/
    );

    if (daysMatch) {
      const timingText = afterQuantity.slice(
        daysMatch.index +
        daysMatch[0].length
      );

      if (regularStartRE.test(timingText)) {
        return true;
      }
    }

    // 頓服薬は「処方分」「回分」「回」より後ろを判定
    const prnMatch = afterQuantity.match(
      /\d+(?:\.\d+)?(?:処方分|回分|回)/
    );

    if (prnMatch) {
      const timingText = afterQuantity.slice(
        prnMatch.index +
        prnMatch[0].length
      );

      if (prnEndRE.test(timingText)) {
        return true;
      }
    }

    return false;
  });
}

/* ========================================
   OCR薬剤の選択処理
======================================== */

function getSelectedOCRIndexes() {
  return [
    ...$("ocrDrugList")
      .querySelectorAll(
        'input[type="checkbox"]:checked'
      )
  ].map(input => Number(input.value));
}

function updateSelectedOCRCount() {
  $("selectedOCRCount").textContent =
    `選択中：${getSelectedOCRIndexes().length}件`;
}

function updateOCRLines() {
  cancelBatchRegistration();

  const blocks = getOCRBlocks();

  $("ocrDrugList").replaceChildren();

  blocks.forEach((block, index) => {
    const label =
      document.createElement("label");

    label.className = "ocr-drug-item";

    const checkbox =
      document.createElement("input");

    checkbox.type = "checkbox";
    checkbox.value = index;

    checkbox.addEventListener(
      "change",
      updateSelectedOCRCount
    );

    const span =
      document.createElement("span");

    span.textContent =
      block.split("\n")[0];

    label.append(
      checkbox,
      span
    );

    $("ocrDrugList").append(label);
  });

  updateSelectedOCRCount();
}

function selectAllOCRDrugs() {
  $("ocrDrugList")
    .querySelectorAll(
      'input[type="checkbox"]'
    )
    .forEach(input => {
      input.checked = true;
    });

  updateSelectedOCRCount();
}

function clearOCRSelection() {
  $("ocrDrugList")
    .querySelectorAll(
      'input[type="checkbox"]'
    )
    .forEach(input => {
      input.checked = false;
    });

  updateSelectedOCRCount();
}


/* ========================================
   定期薬の服薬タイミング解析
======================================== */

function parseMedicationTimings(text) {
  // 文字列を正規化
  const source = String(text ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/就寝|寝る/g, "寝")
    .replace(/起床/g, "起")
    .replace(/毎食/g, "朝昼夕");

  // 開始文字と有効な終端文字のペア
  const validPairs = {
    "起": ["後"],
    "朝": ["前", "後"],
    "昼": ["前", "後"],
    "食": ["間"],
    "夕": ["前", "後"],
    "寝": ["前"]
  };

  const results = [];
  let pending = [];

  // 文字列を先頭から順番に探索
  for (let i = 0; i < source.length; i++) {
    // 「夜間」は服薬タイミングとして扱わない
    if (source.startsWith("夜間", i)) {
      pending = [];
      i++;
      continue;
    }

    const char = source[i];

    // 開始文字が見つかった場合
    if (
      Object.prototype.hasOwnProperty.call(
        validPairs,
        char
      )
    ) {
      // 重複を避けて候補に追加
      if (!pending.includes(char)) {
        pending.push(char);
      }
    }

    // 終端文字が見つかった場合
    else if ("前後間".includes(char)) {
      // 保持している開始文字をすべて判定
      for (const start of pending) {
        if (validPairs[start].includes(char)) {
          const timing = start + char;

          // 同じタイミングは重複登録しない
          if (!results.includes(timing)) {
            results.push(timing);
          }
        }
      }

      // この探索を終了
      // 次の開始文字があれば再探索
      pending = [];
    }
  }

  return results;
}


/* ========================================
   OCR薬剤情報の抽出
======================================== */

function extractPrescriptionDetails(block) {
  const text = normalizeOCR(block)
    .replace(/ /g, "");

  const lines = text.split("\n");

  const result = {
    name: "",
    strength: "",
    total: "",
    days: null,
    prnCount: null,
    timings: [],
    prnTiming: "",
    type: "regular",
    warnings: []
  };

  const first = lines[0] || "";

  const strengthMatch = first.match(
    /(\d+(?:\.\d+)?(?:mg|μg|mcg|g))/i
  );

  if (strengthMatch) {
    result.name = first
      .slice(0, strengthMatch.index)
      .trim();

    result.strength = strengthMatch[1];
  } else {
    result.name = first;

    result.warnings.push(
      "規格を判定できませんでした。"
    );
  }

  const quantityMatch = text.match(
    /(?:内服|屯服|頓服)[/／]調剤数量:/
  );

  if (!quantityMatch) {
    result.warnings.push(
      "調剤数量の項目が見つかりません。"
    );

    return result;
  }

  const rest = text.slice(
    quantityMatch.index +
    quantityMatch[0].length
  );

  const prnMatch = rest.match(
    /(\d+(?:\.\d+)?)\s*(?:処方分|回分|回)/
  );

  const dayMatch = rest.match(
    /(\d+)日分/
  );

  const explicitPrn =
    /(?:屯服|頓服)[/／]調剤数量:/
      .test(quantityMatch[0]);

  const likelyPrn =
    explicitPrn ||
    (
      !!prnMatch &&
      (
        !dayMatch ||
        prnMatch.index < dayMatch.index
      )
    );

  if (likelyPrn) {
    result.type = "prn";

    if (prnMatch) {
      result.prnCount =
        Number(prnMatch[1]);

      const after = rest.slice(
        prnMatch.index +
        prnMatch[0].length
      ).trimStart();

      const timeIndex =
        after.indexOf("時");

      result.prnTiming =
        timeIndex >= 0
          ? after
              .slice(0, timeIndex + 1)
              .replace(/\n/g, "")
              .trim()
          : "";

      if (!result.prnTiming) {
        result.warnings.push(
          "頓服の服薬タイミングを判定できませんでした。"
        );
      }
    } else {
      result.warnings.push(
        "頓服の処方数が見つかりません。"
      );
    }

    return result;
  }

  if (dayMatch) {
    result.days =
      Number(dayMatch[1]);

    const beforeDays = rest.slice(
      0,
      dayMatch.index
    );

    const quantity = beforeDays.match(
      /^(\d+(?:\.\d+)?)/
    );

    result.total =
      quantity ? quantity[1] : "";

    
/* ========================================
   服薬タイミングの抽出
======================================== */

// 「〇日分」より後ろを優先して探索
const timingText = rest.slice(
  dayMatch.index + dayMatch[0].length
);

result.timings = parseMedicationTimings(timingText);

// 見つからない場合は調剤数量以降を再探索
if (result.timings.length === 0) {
  result.timings = parseMedicationTimings(rest);
}

  } else {
    result.warnings.push(
      "処方日数が見つかりません。"
    );
  }

  if (!result.timings.length) {
    result.type = "prn";
    result.total = "";
    result.days = null;

    if (prnMatch) {
      result.prnCount =
        Number(prnMatch[1]);

      const after = rest.slice(
        prnMatch.index +
        prnMatch[0].length
      );

      const pos =
        after.indexOf("時");

      result.prnTiming =
        pos < 0
          ? ""
          : after
              .slice(0, pos + 1)
              .replace(/\n/g, "")
              .trim();
    }

    result.warnings.push(
      "定期薬の服薬タイミングがないため、頓服薬として判定しました。確認してください。"
    );
  }

  return result;
}

/* ========================================
   OCRから1件反映
======================================== */

function applyOCRToDrugForm() {
  const indexes =
    getSelectedOCRIndexes();

  if (indexes.length !== 1) {
    alert(
      "反映する薬剤を1件だけ選択してください。"
      
    );
    return;
  }

  const result =
    extractPrescriptionDetails(
      getOCRBlocks()[indexes[0]]
    );

  if (result.warnings.length) {
    const proceed = confirm(
      "読み取りに確認事項があります。\n\n" +
      result.warnings.join("\n") +
      "\n\n入力欄へ反映しますか？"
    );

    if (!proceed) return;
  }

  $("drugId").value = "";
  $("drugName").value = result.name;
  $("strength").value = result.strength;
  $("drugType").value = result.type;
  $("total").value = result.total;
  $("prescriptionDays").value = result.days ?? "";
  $("prnCount").value = result.prnCount ?? "";
  $("prnTiming").value = result.prnTiming;
  setTimingFields(result.timings);

  remainingManuallyEdited = false;
  updateDrugTypeFields();
  calculateInitialRemaining(true);

  $("drugForm").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

/* ========================================
   OCR複数薬剤の一括登録
======================================== */

function prepareBatchRegistration() {
  const indexes = getSelectedOCRIndexes();

  if (!indexes.length) {
    alert("登録する薬剤を選択してください。");
    return;
  }

  const blocks = getOCRBlocks();
  const drugs = [];
  const warnings = [];
  const errors = [];

  for (const index of indexes) {
    const parsed =
      extractPrescriptionDetails(blocks[index]);

    const drug = {
      name: parsed.name,
      strength: parsed.strength,
      type: parsed.type,
      total: parsed.total,
      prescriptionDays: parsed.days,
      prnCount: parsed.prnCount,
      timings: parsed.timings,
      prnTiming: parsed.prnTiming,
      prescribed: "",
      endDate: "",
      remaining:
        parsed.type === "prn"
          ? (parsed.prnCount || 0)
          : (parsed.days || 0) * parsed.timings.length,
      isPast: false
    };

    if (parsed.warnings.length) {
      warnings.push(
        `${drug.name}：${parsed.warnings.join("、")}`
      );
    }

    if (!drug.name || !drug.strength) {
      errors.push(
        `${drug.name || "薬剤名不明"}：薬剤名または規格が不明`
      );
      continue;
    }

    if (
      drug.type === "regular" &&
      (
        !Number.isInteger(drug.prescriptionDays) ||
        drug.prescriptionDays <= 0 ||
        !drug.timings.length
      )
    ) {
      errors.push(
        `${drug.name}：処方日数または服薬タイミングが不明`
      );
      continue;
    }

    if (
      drug.type === "prn" &&
      (
        !Number.isInteger(drug.prnCount) ||
        drug.prnCount <= 0 ||
        !drug.prnTiming
      )
    ) {
      errors.push(
        `${drug.name}：頓服の処方数または服薬タイミングが不明`
      );
      continue;
    }

    drugs.push(drug);
  }

  if (errors.length) {
    alert(
      "読み取り結果を確認してください。" +
      "登録できない薬があります：\n" +
      errors.join("\n")
    );
    return;
  }

  if (!drugs.length) {
    alert("登録する薬剤がありません。");
    return;
  }

  if (warnings.length) {
    const proceed = confirm(
      "以下の確認事項があります。\n\n" +
      warnings.join("\n") +
      "\n\nこの内容で登録を進めますか？"
    );

    if (!proceed) return;
  }

  batchDraft = drugs;
  openPrescriptionDateDialog(drugs, "batch");
}

/* ========================================
   OCR登録キャンセル
======================================== */

function cancelBatchRegistration() {
  batchDraft = [];
}

/* ========================================
   処方日入力ダイアログ
======================================== */

function openPrescriptionDateDialog(
  drugs,
  source = "manual"
) {
  const title = $("modalTitle");
  const body = $("modalBody");

  title.textContent = "処方日を入力";

  body.replaceChildren();

  const description =
    document.createElement("p");

  description.textContent =
    `${drugs.length}件のお薬を登録します。`;

  body.appendChild(description);

  const label = document.createElement("label");
  label.textContent = "処方日";

  const input = document.createElement("input");
  input.type = "date";
  input.value = today();
  input.required = true;

  label.appendChild(input);
  body.appendChild(label);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "orange";
  button.textContent = "登録する";

  button.onclick = () => {
    if (!input.value) {
      alert("処方日を入力してください。");
      return;
    }

    const prescribed = input.value;

    const prepared = drugs.map(drug => {
      const copy = {
        ...drug,
        prescribed
      };

      copy.endDate =
        copy.type === "prn"
          ? ""
          : getEndDate(
              prescribed,
              copy.prescriptionDays
            );

      return copy;
    });

    commitDrugRegistration(prepared, source);
  };

  body.appendChild(button);

  $("modal").classList.remove("hidden");
}

/* ========================================
   薬剤登録の確定
======================================== */

function commitDrugRegistration(
  drugs,
  source = "manual"
) {
  const editId =
    source === "manual"
      ? $("drugId").value
      : "";

  for (const drug of drugs) {
    if (editId) {
      const index = data.drugs.findIndex(
        item => String(item.id) === String(editId)
      );

      if (index >= 0) {
        data.drugs[index] = {
          ...data.drugs[index],
          ...drug,
          id: editId
        };
      }
    } else {
      data.drugs.push({
        ...drug,
        id: createId()
      });
    }
  }

  if (!saveData()) return;

  closeModal();
  cancelBatchRegistration();
  renderSlots();
  renderDrugs();
  showPage("drugs");
}

/* ========================================
   OCRテキスト編集時の更新
======================================== */

function setupOCRTextListener() {
  const input = $("ocrText");

  if (!input) return;

  input.addEventListener("input", () => {
    updateOCRLines();
  });
}

/* ========================================
   服薬記録用の補助関数
======================================== */

function findDrugById(id) {
  return data.drugs.find(
    drug => String(drug.id) === String(id)
  );
}

function findDrugByName(name) {
  return data.drugs.find(
    drug => drug.name === name
  );
}

/* ========================================
   服薬セット
======================================== */

function getRegularDrugs() {
  return data.drugs.filter(drug => {
    const remaining = Number(drug.remaining) || 0;

    return (
      !isPrn(drug) &&
      !drug.isPast &&
      !drug.manuallyPast &&
      remaining > 0
    );
  });
}

function getPrnDrugs() {
  return data.drugs.filter(drug => {
    const remaining = Number(drug.remaining) || 0;

    return (
      isPrn(drug) &&
      !drug.isPast &&
      !drug.manuallyPast &&
      remaining > 0
    );
  });
}

function getMedicationSlots() {
  const groups = new Map();

  for (const drug of getRegularDrugs()) {
    for (const timing of normalizedTimings(drug)) {
      if (!groups.has(timing)) {
        groups.set(timing, []);
      }

      groups.get(timing).push(drug);
    }
  }

  return [...groups.entries()].map(
    ([timing, drugs]) => ({
      timing,
      drugs
    })
  );
}

/* ========================================
   服薬セットの表示
======================================== */

function renderSlots() {
  const root = $("slots");

  if (!root) return;

  root.replaceChildren();

  const slots = getMedicationSlots();

  if (!slots.length) {
    root.textContent =
      "現在登録されている定期薬はありません。";
    return;
  }

  for (const slot of slots) {
    const card = document.createElement("div");
    card.className = "slot-card";

    const heading = document.createElement("h3");
    heading.textContent = slot.timing;

    card.appendChild(heading);

    const list = document.createElement("div");
    list.className = "slot-drugs";

    for (const drug of slot.drugs) {
      const item = document.createElement("div");
      item.className = "slot-drug";

      const name = document.createElement("span");
      name.textContent =
        `${drug.name} ${drug.strength}`;

      item.appendChild(name);

      list.appendChild(item);
    }

    card.appendChild(list);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "greenbtn";
    button.textContent = "服薬を記録する";

    button.onclick = () => {
      recordMedicationSlot(slot.timing);
    };

    card.appendChild(button);
    root.appendChild(card);
  }
}

/* ========================================

      "登録できない薬があります：\n" +
      errors.join("\n")
    );
    return;
  }

  if (!drugs.length) {
    alert("登録する薬剤がありません。");
    return;
  }

  // 選択したすべてのお薬に
  // 同じ処方日を入力する画面を開く
  openPrescriptionDateDialog(
    drugs,
    "ocr"
  );
}

/* ========================================
   OCR一括登録の保存処理
======================================== */

function saveBatchRegistration() {
  const items = [];

  const cards =
    $("batchReviewItems")
      .querySelectorAll(
        ".batch-review-item"
      );

  for (const card of cards) {
    const field = key =>
      card.querySelector(
        `[data-field="${key}"]`
      ).value.trim();

    const type = field("type");

    const days =
      type === "regular" &&
      field("days") !== ""
        ? Number(field("days"))
        : null;

    const prnCount =
      type === "prn" &&
      field("prnCount") !== ""
        ? Number(field("prnCount"))
        : null;

    const timings =
      type === "regular"
        ? readTimingFields(
            card.querySelector(
              ".review-timings"
            )
          )
        : [];

    const remaining =
      field("remaining") === ""
        ? (
            type === "prn"
              ? prnCount || 0
              : (days || 0) *
                timings.length
          )
        : Number(
            field("remaining")
          );

    const drug = {
      id: createId(),
      name: field("name"),
      strength: field("strength"),
      type,

      total:
        type === "regular"
          ? field("total")
          : "",

      prescriptionDays: days,
      prnCount,
      timings,

      prnTiming:
        type === "prn"
          ? field("prnTiming")
          : "",

      prescribed:
        field("prescribed"),

      endDate:
        type === "regular"
          ? getEndDate(
              field("prescribed"),
              days
            )
          : "",

      remaining,
      isPast: remaining === 0
    };

    const error =
      validDrug(drug);

    if (error) {
      alert(
        `${drug.name || "薬剤"}：${error}`
      );
      return;
    }

    items.push(drug);
  }

  data.drugs.push(...items);

  if (saveData()) {
    resetDrugForm();
    showPage("drugs");
  }
}

/* ========================================
   共通：処方日入力 → 登録内容確認 → 保存
======================================== */

let pendingDrugRegistration = null;

function openPrescriptionDateDialog(drugs, mode) {
  pendingDrugRegistration = {
    drugs: drugs.map(drug => ({ ...drug })),
    mode,
    editingId: mode === "manual" ? $("drugId").value : ""
  };

  $("modalTitle").textContent = "処方日を入力";

  const body = $("modalBody");
  body.replaceChildren();

  const label = document.createElement("label");
  label.textContent = "処方日（必須・手動入力）";

  const input = document.createElement("input");
  input.type = "date";
  input.id = "registrationPrescriptionDate";
  input.required = true;

  input.value =
    mode === "manual" && pendingDrugRegistration.editingId
      ? (
          data.drugs.find(
            d => d.id === pendingDrugRegistration.editingId
          )?.prescribed || ""
        )
      : "";

  label.append(input);
  body.append(label);

  const note = document.createElement("p");
  note.className = "hint";

  note.textContent = mode === "ocr"
    ? `選択した${drugs.length}件すべてに同じ処方日を適用します。`
    : "処方日は本日とは限りません。実際の処方日を入力してください。";

  body.append(note);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "orange";
  button.textContent = "登録内容を確認する";
  button.onclick = showDrugRegistrationReview;

  body.append(button);

  $("modal").classList.remove("hidden");
}

/* ========================================
   登録内容の確認画面
======================================== */

function showDrugRegistrationReview() {
  if (!pendingDrugRegistration) return;

  const date =
    $("registrationPrescriptionDate")?.value || "";

  if (!date) {
    alert("処方日を入力してください。");
    $("registrationPrescriptionDate")?.focus();
    return;
  }

  pendingDrugRegistration.prescribed = date;

  const body = $("modalBody");
  body.replaceChildren();

  $("modalTitle").textContent = "登録内容の確認";

  const heading = document.createElement("p");

  heading.textContent =
    `処方日：${date}（${pendingDrugRegistration.drugs.length}件共通）`;

  body.append(heading);

  pendingDrugRegistration.drugs.forEach((drug, index) => {
    const item = document.createElement("div");
    item.className = "batch-review-item";

    const endDate =
      drug.type === "regular"
        ? getEndDate(date, drug.prescriptionDays)
        : "";

    const rows = [
      `${index + 1}. ${drug.name} ${drug.strength}`,
      `種類：${drug.type === "prn" ? "頓服薬" : "定期薬"}`,
      `処方数量：${drug.total || "―"}`,
      `処方日数：${drug.prescriptionDays ?? "―"}`,
      `頓服の処方数：${drug.prnCount ?? "―"}`,
      `服薬タイミング：${
        drug.type === "prn"
          ? (drug.prnTiming || "―")
          : (drug.timings.join("、") || "―")
      }`,
      `処方日：${date}`,
      `薬がなくなる日：${endDate || "―"}`,
      `残数：${drug.remaining}`
    ];

    rows.forEach((line, i) => {
      const p = document.createElement(
        i === 0 ? "h4" : "p"
      );

      p.textContent = line;
      p.style.margin = "3px 0";
      
      item.append(p);
    });

    body.append(item);
  });

  const back = document.createElement("button");
  back.type = "button";
  back.textContent = "処方日を修正する";

  back.onclick = () => {
    const saved = pendingDrugRegistration;

    openPrescriptionDateDialog(
      saved.drugs,
      saved.mode
    );

    $("registrationPrescriptionDate").value =
      saved.prescribed;
  };

  body.append(back);

  const confirmButton =
    document.createElement("button");

  confirmButton.type = "button";
  confirmButton.className = "orange";
  confirmButton.textContent = "登録を確定する";
  confirmButton.onclick = confirmDrugRegistration;

  body.append(confirmButton);
}

/* ========================================
   登録の確定・データ保存
======================================== */

function confirmDrugRegistration() {
  if (!pendingDrugRegistration?.prescribed) return;

  const {
    drugs,
    prescribed,
    mode,
    editingId
  } = pendingDrugRegistration;

  const updated = drugs.map(drug => ({
    ...drug,
    prescribed,
    endDate:
      drug.type === "regular"
        ? getEndDate(
            prescribed,
            drug.prescriptionDays
          )
        : ""
  }));

  for (const drug of updated) {
    const error = validDrug(drug);

    if (error) {
      alert(error);
      return;
    }
  }

  const skipped = [];
  const toSave = [];

  for (const drug of updated) {
    if (
      mode === "ocr" &&
      (
        isDuplicateDrug(drug) ||
        toSave.some(item =>
          item.name === drug.name &&
          item.strength === drug.strength &&
          item.type === drug.type &&
          item.prescribed === drug.prescribed
        )
      )
    ) {
      skipped.push(drug.name);
      continue;
    }

    toSave.push(drug);
  }

  if (!toSave.length) {
    alert("すべて登録済みの薬剤と重複しています。");
    return;
  }

  const oldDrugs = data.drugs.slice();

  if (editingId) {
    const index = data.drugs.findIndex(
      drug => drug.id === editingId
    );

    if (index < 0) {
      alert("編集対象の薬剤が見つかりません。");
      return;
    }

    data.drugs[index] = {
      ...data.drugs[index],
      ...toSave[0]
    };

    delete data.drugs[index].timing;
  } else {
    data.drugs.push(
      ...toSave.map(drug => ({
        id: createId(),
        ...drug
      }))
    );
  }

  if (!saveData()) {
    data.drugs = oldDrugs;
    return;
  }

  pendingDrugRegistration = null;

  closeModal();
  resetDrugForm();
  showPage("drugs");

  if (skipped.length) {
    alert(
      `重複のため${skipped.length}件を除外しました。`
    );
  }
}

/* ========================================
   現在服薬中のお薬
======================================== */

function activeDrugs() {
  return data.drugs.filter(drug =>
    !drug.isPast &&
    !drug.manuallyPast &&
    Number(drug.remaining) > 0
  );
}

/* ========================================
   ホーム画面の服薬ボタン
======================================== */

function renderSlots() {
  const slots = $("slots");

  slots.replaceChildren();

  const drugs = activeDrugs();

  const regular = unique(
    drugs
      .filter(drug => !isPrn(drug))
      .flatMap(normalizedTimings)
  );

  const prn = unique(
    drugs
      .filter(isPrn)
      .map(drug =>
        drug.prnTiming || "未設定"
      )
  );

  for (const timing of regular) {
    const button =
      document.createElement("button");

    button.type = "button";
    button.textContent = timing;

    button.onclick = () =>
      openMedicationSlot(
        timing,
        "regular"
      );

    slots.append(button);
  }

  for (const timing of prn) {
    const button =
      document.createElement("button");

    button.type = "button";
    button.className = "prn-slot";
    button.textContent = timing;

    button.onclick = () =>
      openMedicationSlot(
        timing,
        "prn"
      );

    slots.append(button);
  }
}

/* ========================================
   服薬確認画面
======================================== */

function openMedicationSlot(
  timing,
  type = "regular"
) {
  const drugs = activeDrugs().filter(
    drug => {
      if (type === "prn") {
        return (
          isPrn(drug) &&
          (
            drug.prnTiming ||
            "未設定"
          ) === timing
        );
      }

      return (
        !isPrn(drug) &&
        normalizedTimings(drug)
          .includes(timing)
      );
    }
  );

  if (!drugs.length) {
    renderSlots();
    return;
  }

  $("modalTitle").textContent =
    `${timing} の服薬記録`;
    
  const body = $("modalBody");
  body.replaceChildren();

  const intro =
    document.createElement("p");

  intro.textContent =
    "服薬した薬を選び、確定してください。確定した薬の残数が1減ります。";

  body.append(intro);

  for (const drug of drugs) {
    const label =
      document.createElement("label");

    label.className =
      "medicationItem";

    const input =
      document.createElement("input");

    input.type = "checkbox";
    input.value = drug.id;
    input.checked = true;

    const span =
      document.createElement("span");

    span.textContent =
      `${drug.name} ${drug.strength || ""}` +
      `（残数 ${drug.remaining}）`;

    label.append(input, span);
    body.append(label);
  }

  const button =
    document.createElement("button");

  button.type = "button";
  button.className = "orange";
  button.textContent =
    "服薬を確定する";

  button.onclick = () => {
    const ids = [
      ...body.querySelectorAll(
        'input[type="checkbox"]:checked'
      )
    ].map(input => input.value);

    if (!ids.length) {
      alert(
        "薬剤を選択してください。"
      );
      return;
    }

    recordMedication(
      timing,
      ids
    );

    closeModal();
  };

  body.append(button);

  $("modal")
    .classList.remove("hidden");
}

/* ========================================
   服薬確定・残数減算
======================================== */

function recordMedication(timing, ids) {
  const stamp =
    new Date().toISOString();

  let count = 0;
  const awardId = createId();
  const historyIds = [];

  for (const id of ids) {
    const drug =
      data.drugs.find(
        item => item.id === id
      );

    if (
      !drug ||
      drug.isPast ||
      drug.manuallyPast ||
      Number(drug.remaining) <= 0
    ) {
      continue;
    }

    drug.remaining =
      Number(drug.remaining) - 1;

    if (drug.remaining === 0) {
      drug.isPast = true;
    }

    const historyId = createId();

    data.history.push({
      id: historyId,
      tokenAwardId: awardId,
      drugId: drug.id,
      drugName: drug.name,
      strength: drug.strength,
      timing,
      timestamp: stamp,
      canceled: false,
      remainingAdjusted: true
    });

    historyIds.push(historyId);
    count++;
  }

  if (count) {
    grantTokenForMedication(
      awardId,
      historyIds
    );
  }

  if (count && saveData()) {
    renderTokenUI();
    renderSlots();
    renderDrugs();
    renderHistory();
  }
}

/* ========================================
   服薬履歴
======================================== */

function clearHistorySearch() {
  $("historySearchForm").reset();
  renderHistory();
}

function renderHistory() {
  const root = $("historyList");
  root.replaceChildren();

  const start = $("historyStart")?.value || "";
  const end = $("historyEnd")?.value || "";
  const drugQuery = ($("historyDrugName")?.value || "").trim().toLocaleLowerCase("ja-JP");

  
const history = [...data.history]
  .filter(item => !item.canceled)
    .filter(item => {
      const dateValue = item.timestamp || item.date || "";
      const parsedDate = new Date(dateValue);
      // ISO文字列の日付部分はUTCのため、服薬日時は端末の現地日付で判定する。
      const localDate = Number.isNaN(parsedDate.getTime())
        ? String(dateValue).slice(0, 10)
        : [parsedDate.getFullYear(), String(parsedDate.getMonth() + 1).padStart(2, "0"), String(parsedDate.getDate()).padStart(2, "0")].join("-");
      const name = String(item.drugName || item.name || "薬剤").toLocaleLowerCase("ja-JP");
      return (!start || localDate >= start) &&
        (!end || localDate <= end) &&
        (!drugQuery || name.includes(drugQuery));
    })
    .sort((a, b) => new Date(b.timestamp || b.date || 0) - new Date(a.timestamp || a.date || 0));

    
const count = $("historySearchCount");

const activeHistoryCount = data.history.filter(
  item => !item.canceled
).length;

if (count) {
  count.textContent =
    `${history.length}件表示 / 全${activeHistoryCount}件`;
}

  if (!history.length) {
root.textContent = activeHistoryCount
  ? "検索条件に一致する服薬記録はありません。"
  : "服薬記録はありません。";

    return;
  }

  for (const item of history) {
    const card = document.createElement("div");
    const text = document.createElement("p");
    text.textContent =
      `${formatDateTime(item.timestamp || item.date)}　` +
      `${item.drugName || item.name || "薬剤"}　` +
      `${item.timing || ""}` +
      `${item.canceled ? "（取消済み）" : ""}`;
    card.append(text);

    if (!item.canceled) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "記録を取り消す";
      button.onclick = () => cancelMedication(item.id);
      card.append(button);
    }
    root.append(card);
  }
}

/* ========================================
   服薬取消・残数復元
======================================== */

function cancelMedication(id) {
  const item = data.history.find(
    history => history.id === id
  );

  if (
    !item ||
    item.canceled
  ) {
    return;
  }

  if (
    !confirm(
      "この服薬記録を取り消しますか？"
    )
  ) {
    return;
  }

  item.canceled = true;

  if (item.tokenAwardId) {
    revokeTokenForCanceledMedication(
      item.tokenAwardId
    );
  }

  const drug = data.drugs.find(
    drug => drug.id === item.drugId
  );

  if (
    drug &&
    item.remainingAdjusted
  ) {
    drug.remaining =
      Number(drug.remaining || 0) + 1;

    drug.isPast = false;
  }

  if (saveData()) {
    renderHistory();
    renderSlots();
    renderDrugs();
    
  }
}

/* ========================================
   設定
======================================== */

function renderSettings() {
  const root = $("settingList");
  root.replaceChildren();

  const note = document.createElement("div");

  note.textContent =
    "服薬ボタンは登録した定期薬・頓服薬の服薬タイミングから自動生成されます。変更する場合は「お薬の管理」から薬剤を編集してください。";

  root.append(note);

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = "お薬の管理へ";

  button.onclick = () => showPage("drugs");

  root.append(button);
}

/* ========================================
   メモ追加（背景色対応）
======================================== */

function addMemo(textareaId) {
  const area = $(textareaId);
  const content = area.value.trim();

  if (!content) {
    alert("メモを入力してください。");
    return;
  }

  const colorSelectId =
    textareaId === "quickMemo"
      ? "quickMemoColor"
      : "listMemoColor";

  const colorSelect = $(colorSelectId);

  const selectedColor =
    colorSelect && MEMO_COLORS[colorSelect.value]
      ? colorSelect.value
      : "white";

  const memo = {
    id: createId(),
    text: content,
    date: new Date().toISOString(),
    color: selectedColor
  };

  const previousOrder = data.memoOrder;

  data.memos.push(memo);

  data.memoOrder = [
    String(memo.id),
    ...memoOrderIds().filter(
      id => id !== String(memo.id)
    )
  ];

  if (saveData()) {
    area.value = "";

    if (colorSelect) {
      colorSelect.value = "white";
    }

    renderMemos();
  } else {
    data.memos.pop();
    data.memoOrder = previousOrder;
  }
}

/* ========================================
   メモの表示順序
======================================== */

function memoOrderIds() {
  const saved = Array.isArray(data.memoOrder)
    ? data.memoOrder.map(String)
    : [];

  const ids = new Set(
    data.memos.map(memo => String(memo.id))
  );

  const ordered = saved.filter(
    id => ids.has(id)
  );

  const remaining = [...data.memos]
    .sort((a, b) =>
      String(b.date || b.createdAt || "")
        .localeCompare(String(a.date || a.createdAt || ""))
    )
    .map(memo => String(memo.id))
    .filter(id => !ordered.includes(id));

  return [...ordered, ...remaining];
}

/* ========================================
   メモの表示期間
======================================== */

function filteredMemos() {
  const start = $("start").value;
  const finish = $("finish").value;

  const positions = new Map(
    memoOrderIds().map((id, index) => [id, index])
  );

  return [...data.memos]
    .filter(memo => {
      const day = String(
        memo.date || memo.createdAt || ""
      ).slice(0, 10);

      return (
        (!start || day >= start) &&
        (!finish || day <= finish)
      );
    })
    .sort((a, b) =>
      (positions.get(String(a.id)) ?? Infinity) -
      (positions.get(String(b.id)) ?? Infinity)
    );
}

/* ========================================
   メモの位置交換
======================================== */

function swapMemoPositions(sourceId, targetId) {
  sourceId = String(sourceId);
  targetId = String(targetId);

  if (sourceId === targetId) return;

  const order = memoOrderIds();

  const sourceIndex = order.indexOf(sourceId);
  const targetIndex = order.indexOf(targetId);

  if (sourceIndex < 0 || targetIndex < 0) return;

  [order[sourceIndex], order[targetIndex]] =
    [order[targetIndex], order[sourceIndex]];

  const previousOrder = data.memoOrder;
  data.memoOrder = order;

  if (!saveData()) {
    data.memoOrder = previousOrder;
    return;
  }

  renderMemos();
}

/* ========================================
   メモのドラッグ操作
======================================== */

let memoDragState = null;

function clearMemoDragStyles() {
  document
    .querySelectorAll("#memoGrid .memoCard")
    .forEach(card => {
      card.classList.remove(
        "memo-dragging",
        "memo-drop-target"
      );
    });
}

function getMemoDropTarget(x, y) {
  const element = document.elementFromPoint(x, y);

  return element
    ? element.closest("#memoGrid .memoCard")
    : null;
}

function startMemoDrag(event, card) {
  if (event.button !== undefined && event.button !== 0) {
    return;
  }

  memoDragState = {
    pointerId: event.pointerId,
    source: card,
    startX: event.clientX,
    startY: event.clientY,
    dragging: false
  };

  event.currentTarget.setPointerCapture(event.pointerId);
}

function moveMemoDrag(event) {
  const state = memoDragState;

  if (!state || state.pointerId !== event.pointerId) {
    return;
  }

  const distance = Math.hypot(
    event.clientX - state.startX,
    event.clientY - state.startY
  );

  if (!state.dragging && distance < 8) return;

  state.dragging = true;
  state.source.classList.add("memo-dragging");

  document
    .querySelectorAll("#memoGrid .memo-drop-target")
    .forEach(card => {
      card.classList.remove("memo-drop-target");
    });

  const target = getMemoDropTarget(
    event.clientX,
    event.clientY
  );

  if (target && target !== state.source) {
    target.classList.add("memo-drop-target");
  }
}

function finishMemoDrag(event) {
  const state = memoDragState;

  if (!state || state.pointerId !== event.pointerId) {
    
    return;
  }

  const target = state.dragging
    ? getMemoDropTarget(event.clientX, event.clientY)
    : null;

  const sourceId = state.source.dataset.memoId;
  const targetId = target ? target.dataset.memoId : null;

  memoDragState = null;
  clearMemoDragStyles();

  if (targetId && sourceId !== targetId) {
    swapMemoPositions(sourceId, targetId);
  }
}

/* ========================================
   メモの背景色
======================================== */

const MEMO_COLORS = {
  white: "#ffffff",
  yellow: "#fff5cc",
  green: "#e5f3df",
  blue: "#e3f0ff",
  pink: "#fce5ec"
};

function getMemoColor(memo) {
  return MEMO_COLORS[memo.color] || MEMO_COLORS.white;
}

function renderMemos() {
  const root = $("memoGrid");
  root.replaceChildren();

  for (const memo of filteredMemos()) {
    
    const card = document.createElement("div");
    card.className = "memoCard";
    card.dataset.memoId = String(memo.id);
    card.style.backgroundColor = getMemoColor(memo);

    const handle = document.createElement("div");
    handle.className = "memo-drag-handle";
    handle.textContent = "☰ 移動";
    handle.title = "ドラッグして別のメモと位置を交換";
    handle.setAttribute("aria-label", "メモを移動");

    handle.addEventListener("pointerdown", event => {
      startMemoDrag(event, card);
    });

    handle.addEventListener("pointermove", moveMemoDrag);
    handle.addEventListener("pointerup", finishMemoDrag);
    handle.addEventListener("pointercancel", finishMemoDrag);

    handle.addEventListener("lostpointercapture", () => {
      if (memoDragState?.source === card) {
        document.querySelectorAll("#memoGrid .memoCard")
          .forEach(el => el.classList.remove(
            "memo-dragging", "memo-drop-target"
          ));
        memoDragState = null;
      }
    });

    const date = document.createElement("div");
    date.className = "date";
    date.textContent = formatDateTime(
      memo.date || memo.createdAt
    );

    const content = document.createElement("div");
    content.className = "content";
    content.textContent = memo.text || memo.content || "";

    const actions = document.createElement("div");
    actions.className = "actions";

    const edit = document.createElement("button");
    edit.textContent = "編集";
    edit.onclick = () => editMemo(memo.id);

    const del = document.createElement("button");
    del.textContent = "削除";
    del.onclick = () => deleteMemo(memo.id);

    actions.append(edit, del);
    card.append(handle, date, content, actions);
    root.append(card);
  }
}


/* ========================================
   メモ編集
======================================== */

function editMemo(id) {
  const memo = data.memos.find(
    item => String(item.id) === String(id)
  );

  if (!memo) return;

  $("modalTitle").textContent = "メモの編集";
  $("modalBody").replaceChildren();

  const area = document.createElement("textarea");
  area.value = memo.text || memo.content || "";

  const colorLabel = document.createElement("label");
  colorLabel.textContent = "メモの背景色";

  const colorPicker = document.createElement("div");
  colorPicker.className = "memo-color-picker";

  let selectedColor = MEMO_COLORS[memo.color]
    ? memo.color
    : "white";

  const colorOptions = [
    ["white", "白"],
    ["yellow", "黄色"],
    ["green", "緑"],
    ["blue", "青"],
    ["pink", "ピンク"]
  ];

  const colorButtons = [];

  for (const [key, label] of colorOptions) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "memo-color-option";
    button.style.backgroundColor = MEMO_COLORS[key];
    button.textContent = label;
    button.dataset.color = key;

    button.onclick = () => {
      selectedColor = key;

      colorButtons.forEach(item => {
        item.classList.toggle(
          "selected",
          item.dataset.color === selectedColor
        );
      });
    };

    button.classList.toggle(
      "selected",
      key === selectedColor
    );

    colorButtons.push(button);
    colorPicker.append(button);
  }

  const save = document.createElement("button");
  save.textContent = "保存";
  save.className = "orange";

  save.onclick = () => {
    const text = area.value.trim();

    if (!text) {
      alert("メモを入力してください。");
      return;
    }
    
    const previousText = memo.text;
    const previousColor = memo.color;

    memo.text = text;
    memo.color = selectedColor;

    if (saveData()) {
      closeModal();
      renderMemos();
    } else {
      memo.text = previousText;
      memo.color = previousColor;
    }
  };

  $("modalBody").append(
    area,
    colorLabel,
    colorPicker,
    save
  );

  $("modal").classList.remove("hidden");

}

function saveEditedMemo(id) {
  editMemo(id);
}

function deleteMemo(id) {
  if (
    !confirm(
      "このメモを削除しますか？"
    )
  ) {

    return;
  }

  data.memos = data.memos.filter(
    memo => memo.id !== id
  );

  if (saveData()) {
    renderMemos();
  }
}

/* ========================================
   メモの期間内一括削除
======================================== */

function deleteRange() {
  const start =
    $("start").value;

  const finish =
    $("finish").value;

  if (!start || !finish) {
    alert(
      "開始日と終了日を入力してください。"
    );
    return;
  }

  if (start > finish) {
    alert(
      "日付の範囲を確認してください。"
    );
    return;
  }

  if (
    !confirm(
      
      "指定期間のメモをすべて削除しますか？"
    )
  ) {
    return;
  }

  data.memos = data.memos.filter(
    memo => {
      const day = String(
        memo.date ||
        memo.createdAt ||
        ""
      ).slice(0, 10);

      return (
        day < start ||
        day > finish
      );
    }
  );

  if (saveData()) {
    renderMemos();
  }
}

/* ========================================
   モーダルを閉じる
======================================== */

function closeModal() {
  pendingDrugRegistration = null;

  $("modal").classList.add("hidden");
  $("modalBody").replaceChildren();
}


/* ========================================
   学習クイズ（サーバー不要版）
======================================== */

let TOKEN_QUESTIONS = [];


async function loadTokenQuestions() {
  const response = await fetch("./question.json", {
  cache: "no-store"
});

  if (!response.ok) {
    throw new Error(
      `問題ファイルを取得できませんでした（HTTP ${response.status}）`
    );
  }

  const questions = await response.json();

  if (!Array.isArray(questions) || questions.length === 0) {
    throw new Error("問題が登録されていません。");
  }

  const ids = new Set();

  for (const q of questions) {
    if (
      !q ||
      typeof q.id !== "string" ||
      !q.id ||
      ids.has(q.id) ||
      typeof q.question !== "string" ||
      !q.question ||
      !Array.isArray(q.answers) ||
      !q.answers.length ||
      !q.answers.every(
        a => typeof a === "string" && a.trim()
      ) ||
      typeof q.explanation !== "string" ||
      typeof q.field !== "string" ||
      typeof q.difficulty !== "string"
    ) {
      throw new Error(
        "クイズの問題形式またはIDに誤りがあります。"
      );
    }

    ids.add(q.id);
  }

  TOKEN_QUESTIONS = questions;
}

const TOKEN_INITIAL_REVEALS = 8;

const tokenById = id =>
  TOKEN_QUESTIONS.find(q => q.id === id);

const tokenShuffle = ids => {
  const result = [...ids];

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [result[i], result[j]] =
      [result[j], result[i]];
  }

  return result;
};

/* ========================================
   クイズの状態管理
======================================== */

function initTokenState() {
  if (!data.token || typeof data.token !== "object") {
    data.token = {
      enabled: false,
      earned: 0,
      spent: 0,
      correct: 0,
      round: 1,
      order: [],
      index: 0,
      opened: [],
      solved: false,
      awards: {}
    };
  }

  const t = data.token;

  
  // 問題ファイルと保存済みの出題順序を同期する
  const currentIds = TOKEN_QUESTIONS.map(q => q.id);
  const validIds = new Set(currentIds);

  const oldOrder = Array.isArray(t.order) ? t.order : [];
  const oldIndex = Number.isInteger(t.index) ? t.index : 0;
  const currentId = oldOrder[oldIndex];

  const seenIds = new Set();

  // 現在も存在する問題だけ残す
  const retainedOrder = oldOrder.filter(id => {
    if (!validIds.has(id) || seenIds.has(id)) {
      return false;
    }

    seenIds.add(id);
    return true;
  });

  // 新しく追加された問題を取得する
  const addedIds = currentIds.filter(
    id => !seenIds.has(id)
  );

  const orderChanged =
    retainedOrder.length !== oldOrder.length ||
    addedIds.length > 0;

  if (orderChanged || !oldOrder.length) {

    // 既存の順番を維持し、新しい問題を末尾に追加する
    t.order = retainedOrder.length
      ? [...retainedOrder, ...tokenShuffle(addedIds)]
      : tokenShuffle(currentIds);

    // 現在の問題を維持する
    const updatedIndex = t.order.indexOf(currentId);

    if (updatedIndex >= 0) {
      t.index = updatedIndex;
    } else {

      // 現在の問題が削除された場合
      t.index = Math.min(
        Math.max(oldIndex, 0),
        t.order.length - 1
      );

      t.opened = [];
      t.solved = false;
    }
  }

  if (!Array.isArray(t.opened)) {
    t.opened = [];
  }

  if (!t.awards || typeof t.awards !== "object") {
    t.awards = {};
  }

  if (!Number.isFinite(t.earned)) t.earned = 0;
  if (!Number.isFinite(t.spent)) t.spent = 0;
  if (!Number.isFinite(t.correct)) t.correct = 0;
  if (!Number.isFinite(t.round)) t.round = 1;

  if (
    !Number.isInteger(t.index) ||
    t.index < 0 ||
    t.index >= t.order.length
  ) {
    t.index = 0;
  }

  if (!tokenById(t.order[t.index])) {
    t.order = tokenShuffle(
      TOKEN_QUESTIONS.map(q => q.id)
    );
    t.index = 0;
    t.opened = [];
    t.solved = false;
  }

  const length = Array.from(
    tokenById(t.order[t.index]).question
  ).length;

  if (!t.opened.length && !t.solved) {
    t.opened = tokenShuffle(
      Array.from({ length }, (_, i) => i)
    ).slice(
      0,
      Math.min(TOKEN_INITIAL_REVEALS, length)
    );
  }

  saveData();
}

/* ========================================
   ポイント残高
======================================== */

function tokenBalance() {
  return data.token.earned - data.token.spent;
}

function tokenCurrent() {
  return tokenById(
    data.token.order[data.token.index]
  );
}

function toggleTokenMode(enabled) {
  data.token.enabled = !!enabled;
  saveData();
  renderTokenUI();
}

/* ========================================
   クイズ画面の表示
======================================== */

function renderTokenUI() {
  const t = data.token;

  $("tokenHome").hidden = !t.enabled;

  $("tokenSummary").textContent =
    `${tokenBalance()}pt ／ 正解${t.correct}問`;

  if (!t.enabled) return;

  const q = tokenCurrent();

  $("tokenQuizProgress").textContent =
    `${t.round}周目・第${t.index + 1}問 / ${t.order.length}問`;

  $("tokenBalance").textContent =
    `${tokenBalance()}pt（累計正解${t.correct}問）`;

  $("tokenQuizMeta").textContent =
    `分野：${q.field}`;

  const container = $("tokenMaskedQuestion");
  container.replaceChildren();

  const chars = Array.from(q.question);

  chars.forEach((char, i) => {
    const span = document.createElement("span");
    const visible =
      t.solved || t.opened.includes(i);

    span.className =
      `token-char ${visible ? "open" : "closed"}`;

    span.textContent = visible ? char : "■";

    container.append(span);
  });

  $("tokenRevealInfo").textContent =
    `${t.solved ? chars.length : t.opened.length} / ${chars.length}文字を開示`;

  $("tokenRevealButton").disabled =
    t.solved ||
    tokenBalance() < 1 ||
    t.opened.length >= chars.length;

  $("tokenAnswerArea").hidden = !!t.solved;

  $("tokenAnswerButton").disabled =
    tokenBalance() < 1 || !!t.solved;

  $("tokenSolution").hidden = !t.solved;

  if (t.solved) {
    $("tokenFullQuestion").textContent = q.question;
    $("tokenCorrectAnswer").textContent = q.answers[0];

    $("tokenExplanation").textContent =
      q.explanation + `（難易度：${q.difficulty}）`;
  }
}

/* ========================================
   1ポイントで1文字開示
======================================== */

function revealTokenCharacter() {
  const t = data.token;

  if (
    !t.enabled ||
    t.solved ||
    tokenBalance() < 1
  ) {
    return;
  }

  const available = Array.from(
    tokenCurrent().question
  )
    .map((_, i) => i)
    .filter(i => !t.opened.includes(i));

  if (!available.length) return;

  t.opened.push(
    available[
      Math.floor(Math.random() * available.length)
    ]
  );

  t.spent++;

  saveData();
  renderTokenUI();
}

/* ========================================
   解答判定
======================================== */

function tokenNormalize(s) {
  return String(s || "")
    .normalize("NFKC")
    .replace(/[\s　・･]/g, "")
    .toLowerCase();
}

function submitTokenAnswer() {
  const t = data.token;

  if (
    !t.enabled ||
    t.solved ||
    tokenBalance() < 1
  ) {
    return;
  }

  const answer = $("tokenAnswer").value.trim();

  if (!answer) {
    $("tokenAnswerFeedback").textContent =
      "答えを入力してください。";
    return;
  }

  t.spent++;

  const correct = tokenCurrent().answers.some(
    a => tokenNormalize(a) === tokenNormalize(answer)
  );

  if (correct) {
    t.solved = true;
    t.correct++;
  }

  saveData();
  renderTokenUI();

  if (!correct) {
    $("tokenAnswerFeedback").textContent =
      "不正解です。文字を開示するか、もう一度考えてみましょう。";
  }
}

/* ========================================
   次の問題
======================================== */

function nextTokenQuestion() {
  const t = data.token;

  if (!t.solved) return;

  t.index++;

  if (t.index >= t.order.length) {
    t.round++;
    t.order = tokenShuffle(
      TOKEN_QUESTIONS.map(q => q.id)
    );
    t.index = 0;
  }

  t.solved = false;

  const length = Array.from(
    tokenCurrent().question
  ).length;

  t.opened = tokenShuffle(
    Array.from({ length }, (_, i) => i)
  ).slice(
    0,
    Math.min(TOKEN_INITIAL_REVEALS, length)
  );

  $("tokenAnswer").value = "";
  $("tokenAnswerFeedback").textContent = "";

  saveData();
  renderTokenUI();
}

/* ========================================
   服薬時のポイント付与
======================================== */

function grantTokenForMedication(awardId, historyIds) {
  if (
    !data.token.enabled ||
    !historyIds.length
  ) {
    return;
  }

  data.token.awards[awardId] = {
    historyIds: [...historyIds],
    revoked: false,
    perDrug: true
  };

  // 服薬した薬剤1種類につき1pt
  data.token.earned += historyIds.length;
}

/* ========================================
   服薬取消時のポイント調整
======================================== */

function revokeTokenForCanceledMedication(awardId) {
  const t = data.token;
  const award = t.awards[awardId];

  if (!award || award.revoked) return;

  const canceledCount = award.historyIds.filter(id =>
    data.history.some(
      h => h.id === id && h.canceled
    )
  ).length;

  if (award.perDrug) {
    const previouslyRevoked =
      Number(award.revokedCount) || 0;
      
    if (canceledCount > previouslyRevoked) {
      t.earned = Math.max(
        0,
        t.earned -
          (canceledCount - previouslyRevoked)
      );

      award.revokedCount = canceledCount;
    }

    if (
      canceledCount === award.historyIds.length
    ) {
      award.revoked = true;
    }
  } else if (
    canceledCount === award.historyIds.length
  ) {
    // 旧仕様で一括1pt付与した履歴は、
    // 全件取り消されたときに1ptを減算
    award.revoked = true;

    t.earned = Math.max(
      0,
      t.earned - 1
    );
  }
}

/* ========================================
   アプリの初期化
======================================== */

async function initializeApp() {
  try {
    await loadTokenQuestions();
  } catch (error) {
    console.error(error);

    alert(
      "クイズの問題を読み込めませんでした。" +
      "question.json を同じフォルダに配置し、" +
      "GitHub Pagesから開いてください。\n" +
      error.message
    );

    const quizHome = $("tokenHome");

    if (quizHome) {
      quizHome.hidden = true;
    }

    // クイズの読み込みに失敗しても、
    // 服薬管理機能は使用できるようにする
    TOKEN_QUESTIONS = [
      {
        id: "unavailable",
        field: "",
        difficulty: "",
        question: "問題を読み込めませんでした",
        answers: [""],
        explanation: ""
      }
    ];
  }


initTokenState();

/* クイズを常時有効化 */
data.token.enabled = true;

/* 今日は何の日を読み込む */
await loadTodayTopics();
renderTodayMessage();

/* 日付が変わったときに表示を更新 */
setInterval(renderTodayMessage, 60000);

/* クイズの問題が読み込めなかった場合 */
if (
  TOKEN_QUESTIONS[0]?.id === "unavailable"
) {
  data.token.enabled = false;
}

renderTokenUI();
updateClock();


  setInterval(
    updateClock,
    1000
  );

  $("ocrText").addEventListener(
    "input",
    updateOCRLines
  );

  $("prescriptionDays").addEventListener(
    "input",
    () => {
      calculateInitialRemaining();
    }
  );

  $("remaining").addEventListener(
    "input",
    () => {
      remainingManuallyEdited = true;
    }
  );

  $("prnCount").addEventListener(
    "input",
    calculateInitialRemaining
  );

  $("drugType").addEventListener(
    "change",
    () => {
      remainingManuallyEdited = false;
      updateDrugTypeFields();
    }
  );

  resetDrugForm();

  renderSlots();
  renderDrugs();
  renderMemos();
}

document.addEventListener(
  "DOMContentLoaded",
  initializeApp
);


/* ========================================
   今日は何の日
======================================== */

const TODAY_SWITCH_KEY = "clinicTodayEnabledV1";

let todayTopics = {};
let lastTodayKey = "";

async function loadTodayTopics() {
  try {
    const response = await fetch("today.json", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const parsed = await response.json();

    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      throw new Error("JSONの形式が不正です");
    }

    todayTopics = parsed;

  } catch (error) {
    console.warn(
      "today.json を読み込めませんでした",
      error
    );

    todayTopics = {};
  }
}

function toggleTodayFeature(enabled) {
  localStorage.setItem(
    TODAY_SWITCH_KEY,
    String(!!enabled)
  );

  renderTodayMessage();
}

function renderTodayMessage() {
  const area = document.getElementById("todayMessage");

  if (!area) return;

  const enabled =
    localStorage.getItem(TODAY_SWITCH_KEY) === "true";

  const sw = document.getElementById("todayEnabled");

  if (sw) {
    sw.checked = enabled;
  }

  area.hidden = !enabled;

  if (!enabled) return;

  const date = new Date();

  const key =
    String(date.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(date.getDate()).padStart(2, "0");

  const entry = todayTopics[key];

  const messages = Array.isArray(entry)
    ? entry
    : typeof entry === "string"
      ? [entry]
      : [];

  area.textContent = messages.length
    ? messages.join(" ／ ")
    : "今日は何の日？（この日の登録はありません）";

  lastTodayKey = key;
}


/* ========================================
   データ移行
======================================== */

function openTransferDialog() {
  const body = document.getElementById("modalBody");

  body.replaceChildren();

  const note = document.createElement("p");

  note.textContent =
    "薬・服薬記録・メモ・クイズの進行状況を" +
    "JSONファイルで移行します。" +
    "読み込みは現在のデータをすべて置き換えます。";

  const exportButton = document.createElement("button");

  exportButton.type = "button";
  exportButton.textContent = "データを書き出す";
  exportButton.onclick = exportClinicData;

  const label = document.createElement("label");

  label.textContent =
    "データを読み込む（JSONファイルを選択）";

  const input = document.createElement("input");

  input.type = "file";
  input.accept = ".json,application/json";

  input.onchange = () => importClinicData(input);

  label.append(input);

  body.append(note, exportButton, label);

  document.getElementById("modalTitle").textContent =
    "データ移行";

  document.getElementById("modal")
    .classList.remove("hidden");
}

function exportClinicData() {
  const payload = {
    format: "clinicAppBackup",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: data
  };

  const blob = new Blob(
    [JSON.stringify(payload, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");

  a.href = url;

  a.download =
    "服薬管理バックアップ_" +
    new Date().toISOString().slice(0, 10) +
    ".json";

  document.body.append(a);

  a.click();
  a.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 30000);
}

async function importClinicData(input) {
  const file = input.files?.[0];

  if (!file) return;

  try {
    if (file.size > 20 * 1024 * 1024) {
      throw new Error(
        "20MB以下のファイルを選択してください"
      );
    }

    const parsed = JSON.parse(await file.text());

    if (
      parsed?.format !== "clinicAppBackup" ||
      parsed.version !== 1
    ) {
      throw new Error(
        "このアプリで書き出したバックアップではありません"
      );
    }

    const restored = parsed.data;

    if (
      !restored ||
      typeof restored !== "object" ||
      !Array.isArray(restored.drugs) ||
      !Array.isArray(restored.history) ||
      !Array.isArray(restored.memos)
    ) {
      throw new Error(
        "バックアップ内のデータ形式が正しくありません"
      );
    }

    const confirmed = confirm(
      "現在の薬・服薬記録・メモ・クイズ進行状況を" +
      "バックアップで上書きします。" +
      "元に戻せません。続行しますか？"
    );

    if (!confirmed) return;

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(restored)
    );

    alert(
      "読み込みました。画面を再読み込みします。"
    );

    location.reload();

  } catch (error) {
    alert(
      "読み込みに失敗しました：" + error.message
    );

  } finally {
    input.value = "";
  }
}


/* ========================================
   アプリ共有
======================================== */

function openShareDialog() {
  const appUrl =
    "https://kotom0919.github.io/Medication-management-app/";

  const body = document.getElementById("modalBody");

  body.replaceChildren();

  const url = document.createElement("input");

  url.type = "text";
  url.readOnly = true;
  url.value = appUrl;

  url.setAttribute(
    "aria-label",
    "アプリのURL"
  );

  const copy = document.createElement("button");

  copy.type = "button";
  copy.textContent = "URLをコピー";

  copy.onclick = async () => {
    try {
      await navigator.clipboard.writeText(appUrl);

      alert("URLをコピーしました");

    } catch (error) {
      url.select();

      alert(
        "URLを選択しました。コピーしてください"
      );
    }
  };

  const qr = document.createElement("img");

  qr.src =
    "https://api.qrserver.com/v1/create-qr-code/" +
    "?size=240x240&data=" +
    encodeURIComponent(appUrl);

  qr.alt = "アプリのURLのQRコード";
  qr.width = 240;
  qr.height = 240;
  qr.className = "share-qr";

  const hint = document.createElement("p");

  hint.className = "hint";

  hint.textContent =
    "QRコードの表示にはインターネット接続が必要です。";

  body.append(url, copy, qr, hint);

  document.getElementById("modalTitle").textContent =
    "アプリを共有";

  document.getElementById("modal")
    .classList.remove("hidden");
}
