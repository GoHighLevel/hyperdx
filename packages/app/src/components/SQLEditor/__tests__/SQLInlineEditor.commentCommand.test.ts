import { toggleComment } from '@codemirror/commands';
import { EditorState, Transaction } from '@codemirror/state';

import { createToggleCommentKeyBinding } from '../SQLInlineEditor';
import { clickhouseSql } from '@/utils/codeMirror';

const createCommandTarget = (
  doc: string,
  selection: { anchor: number; head?: number },
) => {
  let state = EditorState.create({
    doc,
    selection,
    extensions: [clickhouseSql()],
  });

  return {
    target: {
      get state() {
        return state;
      },
      dispatch(transaction: Transaction) {
        state = transaction.state;
      },
    },
    getValue: () => state.doc.toString(),
  };
};

describe('SQL comment command', () => {
  it('binds Command/Ctrl+/ to the CodeMirror comment command', () => {
    expect(createToggleCommentKeyBinding()).toEqual({
      key: 'Mod-/',
      run: toggleComment,
    });
  });

  it('comments and uncomments every selected line', () => {
    const { target, getValue } = createCommandTarget('a = 1\nb = 2', {
      anchor: 0,
      head: 11,
    });

    expect(toggleComment(target)).toBe(true);
    expect(getValue()).toBe('-- a = 1\n-- b = 2');
    expect(toggleComment(target)).toBe(true);
    expect(getValue()).toBe('a = 1\nb = 2');
  });
});
