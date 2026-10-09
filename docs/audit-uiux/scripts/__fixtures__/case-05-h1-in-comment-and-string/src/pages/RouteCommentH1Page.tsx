import { createElement } from 'react';
import { RealHeading } from '../components/RealHeading.js';

const e = createElement;

/**
 * JSDoc này nhắc tới <h1> và </h1> nhưng KHÔNG render gì cả.
 * <h1 className="gia">
 */
const MARKUP_IN_STRING = '<h1 className="trong-chuoi">Chuỗi, không phải thẻ</h1>';
// Dòng comment này cũng chứa <h1> trong một dòng khác.

export function RouteCommentH1Page() {
  return e('section', { title: MARKUP_IN_STRING }, e(RealHeading, null));
}
