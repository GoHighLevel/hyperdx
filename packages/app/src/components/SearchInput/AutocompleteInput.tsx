import {
  useCallback,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import cx from 'classnames';
import {
  ActionIcon,
  Loader,
  Popover,
  Textarea,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { IconMessageCode } from '@tabler/icons-react';

import {
  type TokenInfo,
  tokenizeAtCursor,
} from '@/hooks/useAutoCompleteOptions';
import { useQueryHistory } from '@/utils';

import InputLanguageSwitch from './InputLanguageSwitch';
import { toggleLuceneLineComments } from './queryComments';

import styles from './AutocompleteInput.module.scss';

export default function AutocompleteInput({
  inputRef,
  onCursorChange,
  value,
  onChange,
  placeholder = 'Search your events for anything...',
  autocompleteOptions,
  variableOptions,
  isLoadingValues,
  tokenInfo,
  size = 'sm',
  aboveSuggestions,
  belowSuggestions,
  rightAdornment,
  showSuggestionsOnEmpty,
  suggestionsHeader = 'Properties',
  zIndex = 999,
  onLanguageChange,
  language,
  onSubmit,
  queryHistoryType,
  enableCommentToggle = false,
  'data-testid': dataTestId,
}: {
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  onCursorChange?: (position: number) => void;
  value?: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  size?: 'xs' | 'sm' | 'lg';
  autocompleteOptions?: { value: string; label: string }[];
  variableOptions?: { value: string; label: string; description: string }[];
  isLoadingValues?: boolean;
  tokenInfo?: TokenInfo;
  aboveSuggestions?: React.ReactNode;
  belowSuggestions?: React.ReactNode;
  /** Rendered at the right edge of the input, left of the language switch. */
  rightAdornment?: React.ReactNode;
  showSuggestionsOnEmpty?: boolean;
  suggestionsHeader?: string;
  zIndex?: number;
  onLanguageChange?: (language: 'sql' | 'lucene') => void;
  language?: 'sql' | 'lucene';
  queryHistoryType?: string;
  enableCommentToggle?: boolean;
  'data-testid'?: string;
}) {
  const suggestionsLimit = 10;
  const suggestionsId = useId();

  const [isSearchInputFocused, _setIsSearchInputFocused] = useState(false);
  const [isInputDropdownOpen, setIsInputDropdownOpen] = useState(false);
  const setIsSearchInputFocused = useCallback(
    (state: boolean) => {
      _setIsSearchInputFocused(state);
      setIsInputDropdownOpen(state);
    },
    [_setIsSearchInputFocused],
  );
  const [rightSectionWidth, setRightSectionWidth] = useState<number | 'auto'>(
    'auto',
  );
  const [inputWidth, setInputWidth] = useState<number>(720);
  const commentOverlayRef = useRef<HTMLPreElement>(null);

  const [selectedAutocompleteIndex, setSelectedAutocompleteIndex] =
    useState(-1);

  const [selectedQueryHistoryIndex, setSelectedQueryHistoryIndex] =
    useState(-1);
  // query search history
  const [queryHistory, setQueryHistory] = useQueryHistory(queryHistoryType);
  const queryHistoryList = useMemo(() => {
    if (!queryHistoryType || !queryHistory) return [];
    return queryHistory.map(q => {
      return {
        value: q,
        label: q,
      };
    });
  }, [queryHistory, queryHistoryType]);

  const showSearchHistory =
    value != null &&
    value.length === 0 &&
    queryHistoryList.length > 0 &&
    queryHistoryType;

  const tokenPrefix = tokenInfo?.prefix ?? '';
  const colonIndex = tokenPrefix.indexOf(':');
  const completingValue = colonIndex >= 0;

  /**
   * The `$var` fragment being typed at the end of the token, if any. A
   * variable reference is completed within its token rather than replacing it,
   * so `ServiceName:$sv` can become `ServiceName:$svc` instead of just `$svc`.
   */
  const variableFragment = useMemo(
    () => tokenPrefix.match(/\$[A-Za-z0-9_]*$/)?.[0],
    [tokenPrefix],
  );

  const suggestedVariables = useMemo(() => {
    if (variableFragment == null || !variableOptions?.length) return [];
    return variableOptions.filter(option =>
      option.value.startsWith(variableFragment),
    );
  }, [variableFragment, variableOptions]);

  const suggestedProperties = useMemo(() => {
    if (!tokenPrefix && !showSuggestionsOnEmpty) return [];
    if (completingValue) {
      const field = tokenPrefix.slice(0, colonIndex);
      // Match the value independently of its quoting: level:err and
      // level:"err both suggest level:"error". Keep insertion text escaped.
      const unquote = (text: string) =>
        text
          .replace(/^"/, '')
          // A closing quote can follow pairs of escaped backslashes.
          .replace(/(^|[^\\])((?:\\\\)*)"$/, '$1$2')
          .replace(/\\(.)/gs, '$1');
      const fragment = unquote(tokenPrefix.slice(colonIndex + 1)).toLowerCase();
      return (autocompleteOptions ?? []).filter(option => {
        const separator = option.value.indexOf(':');
        return (
          separator >= 0 &&
          option.value.slice(0, separator) === field &&
          unquote(option.value.slice(separator + 1))
            .toLowerCase()
            .includes(fragment)
        );
      });
    }
    const fragment = tokenPrefix.toLowerCase();
    return (autocompleteOptions ?? [])
      .filter(option => !option.value.includes(':'))
      .filter(option => option.value.toLowerCase().includes(fragment))
      .sort(
        (a, b) =>
          Number(b.value.toLowerCase().startsWith(fragment)) -
          Number(a.value.toLowerCase().startsWith(fragment)),
      )
      .map(option => ({ ...option, isField: true }));
  }, [
    tokenPrefix,
    completingValue,
    colonIndex,
    autocompleteOptions,
    showSuggestionsOnEmpty,
  ]);

  // While a `$var` fragment is being typed, variables are the only useful
  // suggestions, since no property name can match a token ending in `$…`.
  const suggestions: {
    value: string;
    label: string;
    description?: string;
    isVariable?: boolean;
    isField?: boolean;
  }[] =
    suggestedVariables.length > 0
      ? suggestedVariables.map(option => ({ ...option, isVariable: true }))
      : suggestedProperties;

  useLayoutEffect(() => {
    if (isInputDropdownOpen && selectedAutocompleteIndex >= 0) {
      document
        .getElementById(`${suggestionsId}-${selectedAutocompleteIndex}`)
        ?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [isInputDropdownOpen, selectedAutocompleteIndex, suggestionsId]);

  const onSelectSearchHistory = (query: string) => {
    setSelectedQueryHistoryIndex(-1);
    onChange(query); // update inputText bar
    setQueryHistory(query); // update history order
    setIsInputDropdownOpen(false); // close dropdown since we execute search
    onSubmit?.(); // search
  };

  const onAcceptSuggestion = (
    suggestion: string,
    isVariable = false,
    isField = false,
  ) => {
    setSelectedAutocompleteIndex(-1);

    if (value == null || !tokenInfo) {
      onChange(suggestion);
      inputRef.current?.focus();
      return;
    }

    // Replace the token at cursor with the suggestion — except for a variable,
    // which replaces only the `$var` fragment so anything the reference is
    // scoped to (`ServiceName:`) survives.
    const current = tokenizeAtCursor(
      value,
      inputRef.current?.selectionStart ?? value.length,
    );
    const existingColon = current.token.indexOf(':');
    const variableStart =
      current.prefix.length - (variableFragment?.length ?? 0);
    const variableSuffix =
      current.token.slice(current.prefix.length).match(/^[A-Za-z0-9_]*/)?.[0] ??
      '';
    const replacement =
      isVariable && variableFragment != null
        ? current.token.slice(0, variableStart) +
          suggestion +
          current.token.slice(current.prefix.length + variableSuffix.length)
        : isField
          ? suggestion +
            (existingColon >= 0 ? current.token.slice(existingColon) : ':')
          : suggestion;
    const newValue =
      value.slice(0, current.start) + replacement + value.slice(current.end);

    // Place cursor right after the inserted suggestion
    const newCursorPos =
      current.start +
      (isField
        ? suggestion.length + 1
        : isVariable
          ? variableStart + suggestion.length
          : replacement.length);

    onChange(newValue);

    requestAnimationFrame(() => {
      inputRef.current?.setSelectionRange(newCursorPos, newCursorPos);
      inputRef.current?.focus();
      onCursorChange?.(newCursorPos);
    });
  };

  const onToggleComment = useCallback(() => {
    const input = inputRef.current;
    if (input == null) return;
    const result = toggleLuceneLineComments(
      value ?? '',
      input.selectionStart,
      input.selectionEnd,
    );
    onChange(result.value);
    requestAnimationFrame(() => {
      input.setSelectionRange(result.selectionStart, result.selectionEnd);
      input.focus();
    });
  }, [inputRef, onChange, value]);
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (ref.current) {
      setRightSectionWidth(ref.current.clientWidth);
    }
    if (inputRef.current) {
      setInputWidth(inputRef.current.clientWidth);
    }
  }, [language, onLanguageChange, rightAdornment, inputRef]);

  // Height including the 2px border from .textarea (1px top + 1px bottom)
  const baseHeight = size === 'xs' ? 30 : size === 'lg' ? 44 : 38;

  return (
    <div
      className={styles.root}
      style={{ ['--autocomplete-base-height' as string]: `${baseHeight}px` }}
      data-expanded="true"
    >
      <Popover
        withRoles={false}
        opened={isInputDropdownOpen}
        onChange={setIsInputDropdownOpen}
        position="bottom-start"
        offset={8}
        width="target"
        withinPortal
        closeOnClickOutside
        closeOnEscape
        styles={{
          dropdown: {
            maxWidth: inputWidth > 300 ? inputWidth : 720,
            width: '100%',
            zIndex,
          },
        }}
      >
        <Popover.Target>
          <div className={styles.inputContainer}>
            <Textarea
              ref={inputRef}
              placeholder={placeholder}
              className={cx(
                styles.textarea,
                isSearchInputFocused && styles.focused,
                enableCommentToggle && styles.commentHighlightEnabled,
              )}
              value={value}
              size={size}
              autosize
              minRows={1}
              maxRows={8}
              data-testid={dataTestId}
              aria-autocomplete="list"
              aria-haspopup="listbox"
              aria-controls={isInputDropdownOpen ? suggestionsId : undefined}
              aria-activedescendant={
                isInputDropdownOpen && selectedAutocompleteIndex >= 0
                  ? `${suggestionsId}-${selectedAutocompleteIndex}`
                  : undefined
              }
              onChange={e => {
                setSelectedAutocompleteIndex(-1);
                setIsInputDropdownOpen(true);
                onCursorChange?.(e.currentTarget.selectionStart);
                onChange(e.target.value);
              }}
              onSelect={e => {
                setSelectedAutocompleteIndex(-1);
                onCursorChange?.(e.currentTarget.selectionStart);
              }}
              onScroll={e => {
                if (commentOverlayRef.current != null) {
                  commentOverlayRef.current.scrollTop =
                    e.currentTarget.scrollTop;
                  commentOverlayRef.current.scrollLeft =
                    e.currentTarget.scrollLeft;
                }
              }}
              onFocus={() => {
                setSelectedAutocompleteIndex(-1);
                setSelectedQueryHistoryIndex(-1);
                setIsSearchInputFocused(true);
              }}
              onBlur={() => {
                setSelectedAutocompleteIndex(-1);
                setSelectedQueryHistoryIndex(-1);
                setIsSearchInputFocused(false);
              }}
              onKeyDown={e => {
                if (e.nativeEvent.isComposing) return;
                if (e.key === ' ' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  setIsInputDropdownOpen(true);
                  return;
                }
                if (
                  enableCommentToggle &&
                  e.key === '/' &&
                  (e.metaKey || e.ctrlKey)
                ) {
                  e.preventDefault();
                  onToggleComment();
                  return;
                }

                if (
                  e.key === 'Escape' &&
                  e.target instanceof HTMLTextAreaElement
                ) {
                  e.preventDefault();
                  setIsInputDropdownOpen(false);
                  setSelectedAutocompleteIndex(-1);
                  return;
                }

                // A newline must never accept a highlighted suggestion.
                if (e.key === 'Enter' && e.shiftKey) return;

                // Autocomplete Navigation/Acceptance Keys
                if (
                  e.key === 'Tab' &&
                  e.target instanceof HTMLTextAreaElement
                ) {
                  if (
                    isInputDropdownOpen &&
                    !e.shiftKey &&
                    suggestions.length > 0 &&
                    selectedAutocompleteIndex < suggestions.length &&
                    selectedAutocompleteIndex >= 0
                  ) {
                    e.preventDefault();
                    const selected = suggestions[selectedAutocompleteIndex];
                    onAcceptSuggestion(
                      selected.value,
                      selected.isVariable,
                      selected.isField,
                    );
                  }
                }
                if (
                  e.key === 'Enter' &&
                  e.target instanceof HTMLTextAreaElement
                ) {
                  if (
                    isInputDropdownOpen &&
                    suggestions.length > 0 &&
                    selectedAutocompleteIndex < suggestions.length &&
                    selectedAutocompleteIndex >= 0
                  ) {
                    e.preventDefault();
                    const selected = suggestions[selectedAutocompleteIndex];
                    onAcceptSuggestion(
                      selected.value,
                      selected.isVariable,
                      selected.isField,
                    );
                  } else {
                    // Allow shift+enter to still create new lines
                    if (!e.shiftKey) {
                      e.preventDefault();
                      if (queryHistoryType && value) {
                        setQueryHistory(value);
                      }
                      onSubmit?.();
                      setIsInputDropdownOpen(false);
                    }
                  }
                }
                if (
                  e.key === 'ArrowDown' &&
                  e.target instanceof HTMLTextAreaElement
                ) {
                  if (isInputDropdownOpen && suggestions.length > 0) {
                    e.preventDefault();
                    setSelectedAutocompleteIndex(
                      Math.min(
                        selectedAutocompleteIndex + 1,
                        suggestions.length - 1,
                        suggestionsLimit - 1,
                      ),
                    );
                  }
                }
                if (
                  e.key === 'ArrowUp' &&
                  e.target instanceof HTMLTextAreaElement
                ) {
                  if (isInputDropdownOpen && suggestions.length > 0) {
                    e.preventDefault();
                    setSelectedAutocompleteIndex(
                      Math.max(selectedAutocompleteIndex - 1, 0),
                    );
                  }
                }
              }}
              rightSectionWidth={rightSectionWidth}
              rightSection={
                rightAdornment != null ||
                enableCommentToggle ||
                (language != null && onLanguageChange != null) ? (
                  <div ref={ref} className={styles.rightSection}>
                    {rightAdornment}
                    {enableCommentToggle && (
                      <Tooltip label="Comment or uncomment query lines (Command/Ctrl+/)">
                        <ActionIcon
                          variant="subtle"
                          size="sm"
                          aria-label="Comment or uncomment query lines"
                          onMouseDown={event => event.preventDefault()}
                          onClick={onToggleComment}
                        >
                          <IconMessageCode size={16} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                    {language != null && onLanguageChange != null && (
                      <InputLanguageSwitch
                        language={language}
                        onLanguageChange={onLanguageChange}
                      />
                    )}
                  </div>
                ) : undefined
              }
            />
            {enableCommentToggle && (
              <pre
                ref={commentOverlayRef}
                className={cx(styles.commentOverlay, styles[`size-${size}`])}
                style={{
                  paddingRight:
                    typeof rightSectionWidth === 'number'
                      ? rightSectionWidth + 12
                      : undefined,
                }}
                aria-hidden="true"
                data-testid="lucene-comment-highlighting"
              >
                {(value ?? '').split('\n').map((line, index, lines) => (
                  <span key={index}>
                    <span
                      className={
                        line.trimStart().startsWith('//')
                          ? styles.commentedLine
                          : undefined
                      }
                    >
                      {line}
                    </span>
                    {index < lines.length - 1 ? '\n' : null}
                  </span>
                ))}
              </pre>
            )}
          </div>
        </Popover.Target>
        <Popover.Dropdown className={styles.dropdown}>
          {aboveSuggestions != null && (
            <div className={styles.aboveSuggestions}>{aboveSuggestions}</div>
          )}
          <div>
            {(suggestions.length > 0 || isLoadingValues || completingValue) && (
              <div className={styles.suggestionsSection}>
                <div className={styles.suggestionsHeaderRow}>
                  <div className={styles.suggestionsHeader}>
                    {suggestedVariables.length > 0
                      ? 'Dashboard variables'
                      : completingValue
                        ? 'Values'
                        : suggestionsHeader}
                    {isLoadingValues && (
                      <Loader size={12} ml={6} color="var(--color-text)" />
                    )}
                  </div>
                  {suggestions.length > suggestionsLimit && (
                    <div className={styles.suggestionsLimit}>
                      (Showing Top {suggestionsLimit})
                    </div>
                  )}
                </div>
                <div
                  role="listbox"
                  id={suggestionsId}
                  aria-label="Search suggestions"
                  className={styles.suggestionsList}
                >
                  {suggestions.length === 0 && (
                    <div className={styles.suggestionItem} role="status">
                      {isLoadingValues
                        ? 'Loading suggestions…'
                        : 'No matching suggestions. You can still type any value.'}
                    </div>
                  )}
                  {suggestions
                    .slice(0, suggestionsLimit)
                    .map(
                      (
                        { value, label, description, isVariable, isField },
                        i,
                      ) => (
                        <div
                          className={cx(
                            styles.suggestionItem,
                            selectedAutocompleteIndex === i && styles.selected,
                          )}
                          role="option"
                          id={`${suggestionsId}-${i}`}
                          aria-selected={selectedAutocompleteIndex === i}
                          data-testid="autocomplete-suggestion"
                          key={value}
                          onMouseDown={e => e.preventDefault()}
                          onMouseOver={() => {
                            setSelectedAutocompleteIndex(i);
                          }}
                          onClick={() => {
                            onAcceptSuggestion(value, isVariable, isField);
                          }}
                        >
                          <span className={styles.suggestionLabel}>
                            {label}
                          </span>
                          {description != null && (
                            <div className={styles.suggestionDescription}>
                              {description}
                            </div>
                          )}
                        </div>
                      ),
                    )}
                </div>
                <div className={styles.keyboardHint}>
                  ↑ ↓ choose · Tab / Enter insert · Shift+Enter new line ·
                  Ctrl+Space suggestions
                </div>
              </div>
            )}
          </div>
          {belowSuggestions != null && (
            <div className={styles.belowSuggestions}>{belowSuggestions}</div>
          )}
          <div>
            {showSearchHistory && (
              <div className={styles.historySection}>
                <div className={styles.historyTitle}>Search History:</div>
                {queryHistoryList.map(({ value, label }, i) => {
                  return (
                    <UnstyledButton
                      className={cx(
                        styles.historyItem,
                        selectedQueryHistoryIndex === i && styles.selected,
                      )}
                      key={value}
                      onMouseOver={() => setSelectedQueryHistoryIndex(i)}
                      onClick={() => onSelectSearchHistory(value)}
                    >
                      <span className={styles.historyItemLabel}>{label}</span>
                    </UnstyledButton>
                  );
                })}
              </div>
            )}
          </div>
        </Popover.Dropdown>
      </Popover>
    </div>
  );
}
