function doPost(e) {
  // CORS 처리 및 응답 헤더 설정
  var output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  
  try {
    // POST로 전달된 JSON 데이터 파싱
    var data = JSON.parse(e.postData.contents);
    
    var affiliation = data.affiliation; // 소속
    var name = data.name;               // 성명
    var signatureData = data.signatureData; // Data URL 형태의 서명 이미지
    var hasFile = data.hasFile;         // 파일 첨부 여부
    
    // 1. Google Drive 폴더 지정 (없으면 생성)
    var folderName = "연수등록부_제출물";
    var folders = DriveApp.getFoldersByName(folderName);
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
    
    // 2. 파일 저장 로직 (선택 사항)
    var fileUrl = "미제출";
    if (hasFile && data.fileData) {
      var decodedFile = Utilities.base64Decode(data.fileData);
      var blobFile = Utilities.newBlob(decodedFile, data.mimeType, name + "_" + data.filename);
      var savedFile = folder.createFile(blobFile);
      fileUrl = savedFile.getUrl();
    }
    
    // 3. 서명 이미지 저장
    // signatureData는 "data:image/png;base64,iVBORw0KGgo..." 형태이므로, 쉼표 이후의 데이터만 추출
    var base64Signature = signatureData.split(',')[1];
    var decodedSignature = Utilities.base64Decode(base64Signature);
    var blobSignature = Utilities.newBlob(decodedSignature, MimeType.PNG, name + "_서명.png");
    var savedSignature = folder.createFile(blobSignature);
    var signatureUrl = savedSignature.getUrl();
    
    // 4. 스프레드시트에 기록
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // 시트가 비어있다면 헤더 추가
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(["제출일시", "소속", "성명", "첨부파일", "서명 확인"]);
    }
    
    var timestamp = new Date();
    sheet.appendRow([timestamp, affiliation, name, fileUrl, signatureUrl]);
    
    // 성공 응답 반환
    var result = {
      "status": "success",
      "message": "저장 완료"
    };
    output.setContent(JSON.stringify(result));
    return output;
    
  } catch (error) {
    // 에러 발생 시 응답 반환
    var result = {
      "status": "error",
      "message": error.toString()
    };
    output.setContent(JSON.stringify(result));
    return output;
  }
}

// OPTIONS 메서드는 CORS Preflight 요청을 위해 필요
function doOptions(e) {
  var headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
  return ContentService.createTextOutput("")
    .setMimeType(ContentService.MimeType.TEXT)
    .setHeaders(headers);
}
