// --- 서명 캔버스 로직 ---
const canvas = document.getElementById('signature-pad');
const ctx = canvas.getContext('2d');
let isDrawing = false;

function resizeCanvas() {
    const wrapper = canvas.parentElement;
    canvas.width = wrapper.clientWidth;
    canvas.height = 200;
    // 캔버스 초기화 시 배경을 하얗게 칠함 (이미지로 저장 시 투명배경 방지)
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// 브라우저 리사이즈 시 캔버스 조정
window.addEventListener('resize', resizeCanvas);

// 드로잉 이벤트 핸들러
function startDrawing(e) {
    isDrawing = true;
    draw(e);
}

function stopDrawing() {
    isDrawing = false;
    ctx.beginPath();
}

function draw(e) {
    if (!isDrawing) return;

    e.preventDefault(); // 모바일 스크롤 방지
    const rect = canvas.getBoundingClientRect();

    // 터치 또는 마우스 좌표 가져오기
    let clientX, clientY;
    if (e.type.includes('touch')) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
}

canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);

canvas.addEventListener('touchstart', startDrawing, { passive: false });
canvas.addEventListener('touchmove', draw, { passive: false });
canvas.addEventListener('touchend', stopDrawing);

function clearSignature() {
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// 초기화 호출
setTimeout(resizeCanvas, 100); // 렌더링 완료 후 크기 조정

// --- URL 파라미터에서 명단 파싱 및 드롭다운 채우기 ---
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    
    // 모드 설정 (both, sign, file)
    const mode = params.get('m') || 'both';
    const groupSignature = document.getElementById('group-signature');
    const groupFile = document.getElementById('group-file');
    const mainTitle = document.getElementById('main-title');
    const subTitle = document.getElementById('sub-title');
    const uploadFile = document.getElementById('upload-file');
    const labelFile = uploadFile.previousElementSibling;

    if (mode === 'sign') {
        groupFile.style.display = 'none';
        subTitle.innerText = "이름을 선택하고 서명해 주세요.";
    } else if (mode === 'file') {
        groupSignature.style.display = 'none';
        mainTitle.innerText = "📁 자료 제출";
        subTitle.innerText = "이름을 선택하고 파일을 제출해 주세요.";
        uploadFile.required = true;
        labelFile.innerText = "제출 자료 (필수)";
    } else {
        // both
        subTitle.innerText = "이름을 선택하고 서명 및 파일을 제출해 주세요.";
    }

    const namesParam = params.get('n');
    const nameSelect = document.getElementById('student-name');
    
    if (namesParam) {
        const names = namesParam.split(',');
        names.forEach(name => {
            const trimmed = name.trim();
            if(trimmed !== '') {
                const option = document.createElement('option');
                option.value = trimmed;
                option.textContent = trimmed;
                nameSelect.appendChild(option);
            }
        });
    } else {
        // URL에 파라미터가 없으면(직접 접속 시) 텍스트 입력으로 변경해주는 안전장치
        const wrapper = nameSelect.parentElement;
        wrapper.innerHTML = '<input type="text" id="student-name" required placeholder="관리자가 명단을 공유하지 않았습니다. 직접 입력하세요.">';
    }
});

// --- Google Apps Script 전송 로직 ---
const GAS_URL = "https://script.google.com/macros/s/AKfycbx06kuxhrgzTklYTw4YqG0rxLhlVa_BUIJ0-EdHq7pPP_sfHRkGB42Xl5susO5g8kEsYA/exec";

document.getElementById('submit-form').addEventListener('submit', async function (e) {
    e.preventDefault();

    if (GAS_URL === "여기에_구글_Apps_Script_웹앱_URL을_입력하세요") {
        alert("Google Apps Script URL이 설정되지 않았습니다. script.js 파일에서 URL을 수정해주세요.");
        return;
    }

    const overlay = document.getElementById('loading-overlay');
    overlay.classList.add('show');

    // Code.gs 호환성을 위해 affiliation은 빈 값이나 기본값 전송
    const affiliation = "교직원"; 
    const name = document.getElementById('student-name').value;
    const fileInput = document.getElementById('upload-file');
    const file = fileInput.files[0];

    // 서명 이미지 Data URL 추출
    const signatureData = canvas.toDataURL('image/png');

    try {
        let payload = {
            affiliation: affiliation,
            name: name,
            signatureData: signatureData,
            hasFile: false
        };

        // 파일이 있는 경우 Base64로 변환하여 추가
        if (file) {
            const base64File = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = error => reject(error);
                reader.readAsDataURL(file);
            });

            payload.hasFile = true;
            payload.filename = file.name;
            payload.mimeType = file.type;
            payload.fileData = base64File;
        }

        // POST 요청
        const response = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (result.status === 'success') {
            alert('성공적으로 등록되었습니다!');
            // 폼 초기화 (드롭다운 초기화)
            const nameEl = document.getElementById('student-name');
            if(nameEl.tagName === 'SELECT') {
                nameEl.selectedIndex = 0;
            } else {
                nameEl.value = '';
            }
            if(fileInput) fileInput.value = '';
            clearSignature();
        } else {
            alert('등록 실패: ' + result.message);
        }
    } catch (error) {
        console.error(error);
        alert('전송 중 오류가 발생했습니다. 네트워크 상태나 Apps Script 설정을 확인해주세요.');
    } finally {
        overlay.classList.remove('show');
    }
});
