const handleCopy = async () => {
  const plainText = tokens.map(token => token.pos === '改行' ? '\n' : token.word).join('');
  
  try {
    if (showFurigana) {
      // 生成带ruby标签的HTML格式
      const htmlContent = tokens.map(token => {
        if (token.pos === '改行') return '\n';
        const shouldUseFurigana = token.furigana && token.furigana !== token.word && containsKanji(token.word) && token.pos !== '記号';
        if (shouldUseFurigana && token.furigana) {
          return generateFuriganaParts(token.word, token.furigana)
            .map(part => part.ruby ? `<ruby>${part.base}<rt>${part.ruby}</rt></ruby>` : part.base)
            .join('');
        }
        return token.word;
      }).join('');
      
      // 使用现代剪贴板API同时提供HTML和纯文本格式
      if (navigator.clipboard && navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([htmlContent], { type: 'text/html' }),
            'text/plain': new Blob([plainText], { type: 'text/plain' })
          })
        ]);
      } else {
        // 降级到文本API（复制HTML标签作为文本）
        await navigator.clipboard.writeText(htmlContent);
      }
      
    } else {
      // 纯文本格式
      await navigator.clipboard.writeText(plainText);
    }
    
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    
  } catch (error) {
    console.warn('现代剪贴板API失败，使用后备方案:', error);
    
    // 后备方案：使用传统方法
    const textarea = document.createElement('textarea');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    
    if (showFurigana) {
      // 生成带ruby标签的HTML内容
      const htmlContent = tokens.map(token => {
        if (token.pos === '改行') return '\n';
        const shouldUseFurigana = token.furigana && token.furigana !== token.word && containsKanji(token.word) && token.pos !== '記号';
        if (shouldUseFurigana && token.furigana) {
          return generateFuriganaParts(token.word, token.furigana)
            .map(part => part.ruby ? `<ruby>${part.base}<rt>${part.ruby}</rt></ruby>` : part.base)
            .join('');
        }
        return token.word;
      }).join('');
      
      textarea.value = htmlContent;
    } else {
      textarea.value = plainText;
    }
    
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, 99999);
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      } else {
        throw new Error('execCommand failed');
      }
    } catch (err) {
      console.error('后备复制方案也失败了:', err);
      alert('复制功能在此浏览器中不受支持。');
    } finally {
      document.body.removeChild(textarea);
    }
  }
};