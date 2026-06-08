// 기본 제공 혜정샘의 GAS URL (초기값용)
const DEFAULT_GAS_URL = "https://script.google.com/macros/s/AKfycbx06kuxhrgzTklYTw4YqG0rxLhlVa_BUIJ0-EdHq7pPP_sfHRkGB42Xl5susO5g8kEsYA/exec";

// DOM 요소들
const setupSection = document.getElementById('setup-section');
const previewSection = document.getElementById('preview-section');
const qrModal = document.getElementById('qr-modal');

const inputGasUrl = document.getElementById('input-gas-url');
const inputMode = document.getElementById('input-mode');
const inputTitle = document.getElementById('input-title');
const inputDate = document.getElementById('input-date');
const inputTime = document.getElementById('input-time');
const inputTimeEnd = document.getElementById('input-time-end');
const inputLocation = document.getElementById('input-location');
const inputNames = document.getElementById('input-names');

const docTitle = document.getElementById('doc-title');
const docDate = document.getElementById('doc-date');
const docLocation = document.getElementById('doc-location');

let parsedNames = [];
let qrCodeInstance = null;

// --- 1. 로컬 스토리지 자동 저장/불러오기 ---
function loadSettings() {
    const saved = localStorage.getItem('signupAdminSettings');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            if (data.gasUrl !== undefined) {
                inputGasUrl.value = data.gasUrl;
            } else {
                inputGasUrl.value = DEFAULT_GAS_URL;
            }
            if (data.mode) inputMode.value = data.mode;
            if (data.title) inputTitle.value = data.title;
            if (data.date) inputDate.value = data.date;
            if (data.time) inputTime.value = data.time;
            if (data.timeEnd) inputTimeEnd.value = data.timeEnd;
            if (data.location) inputLocation.value = data.location;
            if (data.namesText) inputNames.value = data.namesText;
        } catch (e) {
            console.error("설정 불러오기 실패", e);
        }
    }
}

function saveSettings() {
    const data = {
        gasUrl: inputGasUrl.value,
        mode: inputMode.value,
        title: inputTitle.value,
        date: inputDate.value,
        time: inputTime.value,
        timeEnd: inputTimeEnd.value,
        location: inputLocation.value,
        namesText: inputNames.value
    };
    localStorage.setItem('signupAdminSettings', JSON.stringify(data));
}

// 실시간 자동 저장 이벤트
[inputGasUrl, inputMode, inputTitle, inputDate, inputTime, inputTimeEnd, inputLocation, inputNames].forEach(el => {
    if (el) el.addEventListener('input', saveSettings);
});

// 날짜 포맷 변환 (예: 2026-09-24 -> 2026. 9. 24.)
function formatDateForPrint(dateStr, timeStr, timeEndStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const date = d.getDate();
    
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const day = days[d.getDay()];
    
    let result = `${year}. ${month}. ${date}.(${day})`;
    
    if (timeStr && timeEndStr) {
        result += ` ${timeStr} ~ ${timeEndStr}`;
    } else if (timeStr) {
        result += ` ${timeStr}~`;
    }
    
    return result;
}

// --- 2. 명단 파싱 및 표 생성 ---
function renderTable() {
    // 텍스트 영역에서 줄바꿈 기준으로 이름 배열 생성 (빈 줄 제거)
    const rawNames = inputNames.value.split('\n').map(n => n.trim()).filter(n => n.length > 0);
    parsedNames = rawNames;

    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';

    // 행 개수 계산 (2단 표이므로 절반 올림)
    const ROWS = Math.ceil(parsedNames.length / 2);
    // 빈 명단일 경우 기본 25줄 표시
    const renderRows = ROWS > 0 ? ROWS : 25;

    for (let i = 0; i < renderRows; i++) {
        const leftIndex = i;
        const rightIndex = i + renderRows;
        
        const leftName = parsedNames[leftIndex] || "";
        const rightName = parsedNames[rightIndex] || "";

        const tr = document.createElement('tr');
        
        tr.innerHTML = `
            <td>${leftIndex + 1}</td>
            <td class="name-cell" contenteditable="true" data-index="${leftIndex}">${leftName}</td>
            <td class="sign-cell" id="sign-${leftIndex}"></td>
            <td class="remark-cell" contenteditable="true"></td>
            
            <td>${rightIndex < parsedNames.length || parsedNames.length === 0 ? rightIndex + 1 : ''}</td>
            <td class="name-cell" contenteditable="true" data-index="${rightIndex}">${rightName}</td>
            <td class="sign-cell" id="sign-${rightIndex}"></td>
            <td class="remark-cell" contenteditable="true"></td>
        `;
        
        tbody.appendChild(tr);
    }
}

// --- 3. 서명 데이터 가져오기 ---
async function fetchSignatures() {
    const btn = document.getElementById('refresh-btn');
    const originalText = btn.innerText;
    btn.innerText = "⏳ 불러오는 중...";
    btn.disabled = true;

    let targetUrl = inputGasUrl.value.trim();
    if (!targetUrl) {
        targetUrl = DEFAULT_GAS_URL;
    }

    try {
        const response = await fetch(targetUrl);
        const result = await response.json();

        if (result.status === 'success') {
            applySignaturesToTable(result.data);
        } else {
            alert("데이터를 불러오는데 실패했습니다: " + result.message);
        }
    } catch (error) {
        console.error(error);
        alert("네트워크 오류가 발생했습니다. Apps Script 설정을 확인해주세요.");
    } finally {
        overlay.classList.remove('show');
    }
}

function applySignaturesToTable(dataList) {
    const nameCells = document.querySelectorAll('.name-cell');
    
    // 서명 칸 초기화
    nameCells.forEach(cell => {
        const index = cell.getAttribute('data-index');
        document.getElementById(`sign-${index}`).innerHTML = '';
    });

    nameCells.forEach(cell => {
        const currentName = cell.innerText.trim();
        const index = cell.getAttribute('data-index');
        
        if (currentName) {
            const matchedData = dataList.filter(item => item.name === currentName).pop();
            
            if (matchedData && matchedData.signatureUrl && matchedData.signatureUrl !== "미제출") {
                const signCell = document.getElementById(`sign-${index}`);
                let imgUrl = matchedData.signatureUrl;
                if(imgUrl.includes('drive.google.com/file/d/')) {
                    const fileId = imgUrl.split('/d/')[1].split('/')[0];
                    imgUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w200`;
                }
                signCell.innerHTML = `<img src="${imgUrl}" class="sign-img" alt="서명">`;
            }
        }
    });
}

// --- 4. 이벤트 핸들러 ---
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();

    // '미리보기' 버튼 클릭
    document.getElementById('btn-preview').addEventListener('click', () => {
        saveSettings();
        
        // 정보 업데이트
        docTitle.innerText = inputTitle.value || "연수 등록부";
        docDate.innerText = "1. 일시: " + formatDateForPrint(inputDate.value, inputTime.value, inputTimeEnd.value);
        docLocation.innerText = "2. 장소: " + (inputLocation.value || "");
        
        renderTable();
        
        setupSection.style.display = 'none';
        previewSection.style.display = 'block';
    });

    // '설정으로 돌아가기' 버튼 클릭
    document.getElementById('btn-back').addEventListener('click', () => {
        previewSection.style.display = 'none';
        setupSection.style.display = 'block';
    });

    // '서명 새로고침' 버튼 클릭
    document.getElementById('refresh-btn').addEventListener('click', fetchSignatures);

    // 'QR코드 띄우기' 버튼 클릭
    document.getElementById('btn-show-qr').addEventListener('click', () => {
        saveSettings();
        
        // 이름 목록 파싱 및 Base64 암호화
        const rawNames = inputNames.value.split('\n').map(n => n.trim()).filter(n => n.length > 0);
        // UTF-8 문자열을 Base64로 안전하게 인코딩 (한글 깨짐 방지)
        const encodedNames = btoa(unescape(encodeURIComponent(rawNames.join(','))));
        const namesParam = encodeURIComponent(encodedNames);
        
        // GAS URL에서 스크립트 ID 추출
        let scriptId = '';
        const urlValue = inputGasUrl.value.trim() || DEFAULT_GAS_URL;
        const match = urlValue.match(/\/s\/([a-zA-Z0-9_-]+)/);
        if (match && match[1]) {
            scriptId = match[1];
        }

        // URL을 안전하게 조합
        try {
            const urlObj = new URL(window.location.href);
            // admin.html 부분을 index.html로 변경, 없다면 맨 뒤에 추가
            if (urlObj.pathname.endsWith('admin.html')) {
                urlObj.pathname = urlObj.pathname.replace('admin.html', 'index.html');
            } else if (!urlObj.pathname.endsWith('index.html')) {
                urlObj.pathname = urlObj.pathname + (urlObj.pathname.endsWith('/') ? '' : '/') + 'index.html';
            }
            urlObj.search = `?m=${inputMode.value}&g=${scriptId}&n=${namesParam}`;
            const shareUrl = urlObj.href;
            
            document.getElementById('share-link').value = shareUrl;

            // QR 생성
            document.getElementById("qrcode-box").innerHTML = "";
            qrCodeInstance = new QRCode(document.getElementById("qrcode-box"), {
                text: shareUrl,
                width: 250,
                height: 250,
                colorDark : "#3d3b38",
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.L
            });
        } catch (e) {
            console.error("URL 조합 중 오류:", e);
            alert("QR 코드를 생성하는 중 오류가 발생했습니다.");
            return;
        }
        
        qrModal.style.display = 'flex';
    });

    // 워드/한글 문서 저장 로직 추가
    document.getElementById('btn-export-doc').addEventListener('click', () => {
        // 임시로 숨김 버튼들 제거를 위해 복제
        const printContent = previewSection.cloneNode(true);
        const controls = printContent.querySelector('.controls');
        if (controls) controls.remove();
        
        const header = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' 
                  xmlns:w='urn:schemas-microsoft-com:office:word' 
                  xmlns='http://www.w3.org/TR/REC-html40'>
            <head>
                <meta charset='utf-8'>
                <title>연수 등록부</title>
                <style>
                    body { font-family: 'Malgun Gothic', sans-serif; }
                    .document-header { text-align: center; margin-bottom: 20px; }
                    .document-header h1 { font-size: 24px; font-weight: bold; margin-bottom: 30px; }
                    .document-info { text-align: left; font-size: 14px; font-weight: bold; margin-bottom: 10px; margin-left: 20px; }
                    table { border-collapse: collapse; width: 100%; font-size: 13px; table-layout: fixed; }
                    th, td { border: 1px solid black; text-align: center; vertical-align: middle; height: 38px; padding: 2px; }
                    th { background-color: #dbeafe; font-weight: bold; }
                    .col-num { width: 6%; }
                    .col-name { width: 14%; }
                    .col-sign { width: 20%; }
                    .col-remark { width: 10%; }
                    .sign-img { max-width: 90%; max-height: 34px; display: block; margin: 0 auto; }
                </style>
            </head>
            <body>
        `;
        const footer = "</body></html>";
        const sourceHTML = header + printContent.innerHTML + footer;
        
        const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
        const fileDownload = document.createElement("a");
        document.body.appendChild(fileDownload);
        fileDownload.href = source;
        fileDownload.download = '연수등록부.doc';
        fileDownload.click();
        document.body.removeChild(fileDownload);
    });

    // PDF 저장 기능
    document.getElementById('btn-export-pdf').addEventListener('click', () => {
        const element = document.getElementById('preview-section');
        const controls = element.querySelector('.controls');
        controls.style.display = 'none'; // 임시 숨김
        
        const opt = {
            margin:       10,
            filename:     '연수등록부.pdf',
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true, windowWidth: 1000 },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        
        html2pdf().set(opt).from(element).save().then(() => {
            controls.style.display = 'flex'; // 다시 표시
        });
    });

    // 이미지 저장 기능
    document.getElementById('btn-export-img').addEventListener('click', () => {
        const element = document.getElementById('preview-section');
        const controls = element.querySelector('.controls');
        controls.style.display = 'none'; // 임시 숨김
        
        html2canvas(element, { scale: 2, useCORS: true }).then(canvas => {
            const link = document.createElement('a');
            link.download = '연수등록부.png';
            link.href = canvas.toDataURL('image/png');
            link.click();
            controls.style.display = 'flex'; // 다시 표시
        });
    });

    // '닫기' 버튼
    document.getElementById('btn-close-qr').addEventListener('click', () => {
        qrModal.style.display = 'none';
    });

    // '링크 복사' 버튼
    document.getElementById('btn-copy-link').addEventListener('click', () => {
        const linkInput = document.getElementById('share-link');
        linkInput.select();
        document.execCommand('copy');
        alert('링크가 복사되었습니다!');
    });
});
