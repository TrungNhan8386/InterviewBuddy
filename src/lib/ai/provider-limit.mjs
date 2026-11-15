// Browser-safe public copy only; never include provider response bodies or keys.
export function providerLimitMessage(language = 'vi', context = 'generic') {
  const en = language === 'en';
  const message = en
    ? 'The AI provider is limiting requests or has exhausted its quota. Try again later; if this continues, contact the team to check the provider allowance.'
    : 'Nhà cung cấp AI đang giới hạn lượt gọi hoặc đã hết hạn mức (quota). Hãy thử lại sau; nếu lỗi tiếp diễn, liên hệ nhóm để kiểm tra hạn mức dịch vụ.';
  if (context === 'analysis') return message + (en
    ? ' Your JD and CV remain on this page; you do not need to enter them again.'
    : ' JD và CV vẫn được giữ trên trang; bạn không cần nhập lại.');
  if (context === 'interview') return message + (en
    ? ' Your saved questions and answers are kept. You can return to the Dashboard and resume this session later.'
    : ' Câu hỏi và câu trả lời đã lưu được giữ nguyên. Bạn có thể về Dashboard và tiếp tục phiên sau.');
  return message;
}
