let questionsData = [];
let studentsData = {};
let currentStudent = null;
let currentAnswers = {};
let subAnswer = 0;
let currentQIndex = 0;
let timerSeconds = 1800;
let timerInterval = null;
let startTime = null;

window.onload = async () => {
  try {
    const res = await fetch(`${SCRIPT_URL}?action=get_init_data`, {
      redirect: "follow"
    });
    const data = await res.json();
    questionsData = data.questions;
    studentsData = data.students;
  } catch (err) {
    alert("Không thể kết nối tới Google Sheets! Vui lòng kiểm tra file config.js");
  }
};

document.getElementById('form-login').onsubmit = (e) => {
  e.preventDefault();
  const code = document.getElementById('login-code').value.trim();
  const pass = document.getElementById('login-pass').value.trim();
  const alertBox = document.getElementById('login-alert');

  if (!studentsData[code] || studentsData[code].password !== pass) {
    alertBox.textContent = "Mã học sinh hoặc mật khẩu không chính xác!";
    alertBox.classList.remove('d-none');
    return;
  }

  if (studentsData[code].status === "DA_THI") {
    alertBox.textContent = "Tài khoản này đã hoàn thành bài thi trước đó!";
    alertBox.classList.remove('d-none');
    return;
  }

  currentStudent = { code: code, ...studentsData[code] };
  document.getElementById('section-login').classList.add('d-none');
  document.getElementById('section-exam').classList.remove('d-none');
  document.getElementById('student-info-display').textContent = `Thí sinh: ${currentStudent.name} (${currentStudent.class_name})`;

  startExam();
};

function startExam() {
  startTime = new Date();
  renderNavGrid();
  renderQuestion(0);

  timerInterval = setInterval(() => {
    timerSeconds--;
    const m = Math.floor(timerSeconds / 60).toString().padStart(2, '0');
    const s = (timerSeconds % 60).toString().padStart(2, '0');
    document.getElementById('exam-timer').textContent = `${m}:${s}`;

    if (timerSeconds <= 0) {
      clearInterval(timerInterval);
      alert("Hết giờ làm bài! Hệ thống tự động nộp bài.");
      submitExam();
    }
  }, 1000);
}

let tabSwitchCount = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden && currentStudent) {
    tabSwitchCount++;
    alert(`CẢNH BÁO: Bạn đã rời khỏi màn hình làm bài (${tabSwitchCount} lần)!`);
  }
});

function renderNavGrid() {
  const grid = document.getElementById('nav-grid');
  grid.innerHTML = '';
  questionsData.forEach((q, idx) => {
    const btn = document.createElement('button');
    btn.className = `btn btn-outline-secondary nav-q-btn ${currentAnswers[q.id] ? 'btn-success text-white' : ''}`;
    btn.textContent = idx + 1;
    btn.onclick = () => renderQuestion(idx);
    grid.appendChild(btn);
  });

  const subBtn = document.createElement('button');
  subBtn.className = `btn btn-outline-primary nav-q-btn w-100 mt-2 ${subAnswer ? 'btn-primary text-white' : ''}`;
  subBtn.textContent = "Câu phụ";
  subBtn.onclick = () => renderSubQuestion();
  grid.appendChild(subBtn);
}

function renderQuestion(index) {
  currentQIndex = index;
  const q = questionsData[index];
  const box = document.getElementById('question-box');

  let html = `<div class="question-card">
    <h5 class="fw-bold">Câu ${index + 1}: ${q.question}</h5>
    <div class="mt-3">`;

  for (const [key, val] of Object.entries(q.options)) {
    const isSelected = currentAnswers[q.id] === key ? 'selected' : '';
    html += `<button class="opt-btn ${isSelected}" onclick="selectOption('${q.id}', '${key}')">
      <b>${key}.</b> ${val}
    </button>`;
  }
  html += `</div></div>`;
  box.innerHTML = html;
  updateProgress();
}

function renderSubQuestion() {
  currentQIndex = questionsData.length;
  const box = document.getElementById('question-box');
  box.innerHTML = `
    <div class="question-card">
      <h5 class="fw-bold text-primary">CÂU HỎI PHỤ DỰ ĐOÁN</h5>
      <p class="fs-6">Theo bạn, có bao nhiêu thí sinh trong toàn trường sẽ có cùng số câu trả lời đúng giống bạn?</p>
      <input type="number" id="sub-input" class="form-control form-control-lg mt-3" value="${subAnswer || ''}" placeholder="Nhập một số nguyên (ví dụ: 125)" onchange="subAnswer = this.value; renderNavGrid();">
    </div>
  `;
  updateProgress();
}

function selectOption(qId, key) {
  currentAnswers[qId] = key;
  renderNavGrid();
  renderQuestion(currentQIndex);
}

function nextQuestion() {
  if (currentQIndex < questionsData.length - 1) renderQuestion(currentQIndex + 1);
  else renderSubQuestion();
}

function prevQuestion() {
  if (currentQIndex > 0) renderQuestion(currentQIndex - 1);
}

function updateProgress() {
  const total = questionsData.length + 1;
  const answered = Object.keys(currentAnswers).length + (subAnswer ? 1 : 0);
  const pct = Math.round((answered / total) * 100);
  document.getElementById('exam-progress-bar').style.width = `${pct}%`;
}

function confirmSubmit() {
  if (confirm("Bạn có chắc chắn muốn nộp bài thi không?")) {
    submitExam();
  }
}

async function submitExam() {
  clearInterval(timerInterval);
  const durationSeconds = Math.round((new Date() - startTime) / 1000);

  let correctCount = 0;
  questionsData.forEach(q => {
    if (currentAnswers[q.id] === q.answer) correctCount++;
  });

  const payload = {
    action: "submit_exam",
    maHS: currentStudent.code,
    hoTen: currentStudent.name,
    lop: currentStudent.class_name,
    khoi: currentStudent.grade,
    soCauDung: correctCount,
    thoiGianGiay: durationSeconds,
    duDoan: parseInt(subAnswer) || 0
  };

  alert("Đang nộp bài thi lên hệ thống...");
  
  await fetch(SCRIPT_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  alert(`NỘP BÀI THÀNH CÔNG!\n- Số câu đúng: ${correctCount}/${questionsData.length}\n- Thời gian: ${durationSeconds} giây`);
  location.reload();
}

async function showRankings() {
  document.getElementById('section-login').classList.add('d-none');
  document.getElementById('section-rankings').classList.remove('d-none');

  const res = await fetch(`${SCRIPT_URL}?action=get_rankings`);
  const data = await res.json();
  const tbody = document.getElementById('ranking-table-body');
  tbody.innerHTML = '';

  data.results.forEach((r) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span class="badge ${r.xepHang <= 3 ? 'bg-danger' : 'bg-secondary'} fs-6">${r.xepHang || '-'}</span></td>
      <td><b>${r.maHS}</b></td>
      <td>${r.hoTen}</td>
      <td>${r.lop}</td>
      <td><b class="text-success">${r.soCauDung}/30</b></td>
      <td>${r.thoiGian}s</td>
      <td>${r.duDoan}</td>
      <td><span class="badge bg-warning text-dark fw-bold">${r.giaiThuong || 'Chưa tính'}</span></td>
      <td>
        <button class="btn btn-sm btn-outline-primary" onclick="printCertificate('${r.hoTen}', '${r.lop}', '${r.giaiThuong}')">
          <i class="fa-solid fa-print me-1"></i>In Bằng
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function triggerAppScriptRankings() {
  if(!confirm("Bạn có chắc muốn kích hoạt tổng kết toàn trường?")) return;
  alert("Đang tổng kết và xếp hạng...");
  await fetch(SCRIPT_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "calculate_rankings" })
  });
  alert("Đã tổng kết xong! Đang tải lại bảng xếp hạng...");
  setTimeout(showRankings, 2000);
}

function printCertificate(name, className, award) {
  if (!award || award === "Chưa tính") {
    alert("Thí sinh này chưa có kết quả xếp giải!");
    return;
  }
  document.getElementById('cert-name').textContent = name;
  document.getElementById('cert-class').textContent = className;
  document.getElementById('cert-award').textContent = award;

  const qrDiv = document.getElementById('cert-qr');
  qrDiv.innerHTML = '';
  new QRCode(qrDiv, {
    text: `XAC NHAN: ${name} - Lop ${className} - Đat ${award} Cuoc thi Phap Luat 2026`,
    width: 90,
    height: 90
  });

  window.print();
}
