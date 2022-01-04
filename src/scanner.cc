#include <tree_sitter/parser.h>
#include <cwctype>

namespace {

    using std::iswspace;

    enum TokenType {
        COMMENT,
        STRING,
    };

    struct Scanner {
        static void skip(TSLexer *lexer) {
            lexer->advance(lexer, true);
        }

        static void advance(TSLexer *lexer) {
            lexer->advance(lexer, false);
        }

        static bool scan_sequence(TSLexer *lexer, const char *sequence) {
            // Try to match all characters in the given 'sequence'
            for(const char *c = sequence; *c; c++) {
                if(lexer->lookahead == *c) {
                    // Consume the character in 'c'
                    advance(lexer);
                }
                else {
                    return false;
                }
            }

            return true;
        }

        static bool scan_quoted_string(TSLexer *lexer, const char *delimeter) {
            if(scan_sequence(lexer, delimeter)) {
                bool ignore = false;

                while(lexer->lookahead != '\n' && lexer->lookahead != 0) {
                    if(ignore) {
                        ignore = false;
                    }
                    else if(lexer->lookahead == '\\') {
                        ignore = true;
                    }
                    else if(scan_sequence(lexer, delimeter)) {
                        return true;
                    }

                    advance(lexer);
                }
            }

            return false;
        }

        static bool scan_multiline_content(TSLexer *lexer) {
            // Initialize lua multiline content level count
            int start_level = 0;
            int end_level = 0;

            if (lexer->lookahead == '[') {
                // Consume first appearance of '['
                advance(lexer);

                if (lexer->lookahead == '[' || lexer->lookahead == '=') {
                    while (lexer->lookahead == '=') {
                        // Increment level count
                        ++start_level;

                        // Consume all '=' characters
                        advance(lexer);
                    }

                    if (lexer->lookahead == '[') {
                        // Consume last appearance of '['
                        advance(lexer);

                        // Loop while not end of file (eof)
                        while (lexer->lookahead != 0) {
                            // Gives the end level count the same as start level count
                            end_level = start_level;

                            if (lexer->lookahead == ']') {
                                // Consume first appearance of ']'
                                advance(lexer);

                                if (lexer->lookahead == ']' || lexer->lookahead == '=') {
                                    while (lexer->lookahead == '=' && end_level > 0) {
                                        // Decrement level count
                                        --end_level;

                                        // Consume all '=' characters
                                        advance(lexer);
                                    }

                                    if (lexer->lookahead == ']' && end_level == 0) {
                                        // Consume last appearance of ']'
                                        advance(lexer);

                                        return true;
                                    }
                                }
                            }

                            if (lexer->lookahead != 0) {
                                // Consume all but end of file (eof)
                                advance(lexer);
                            }
                        }
                    }
                }
            }

            return false;
        }

        bool scan(TSLexer *lexer, const bool *valid_symbols) {
            if (valid_symbols[COMMENT] || valid_symbols[STRING]) {
                while(iswspace(lexer->lookahead)) {
                    skip(lexer);
                }

                if(scan_quoted_string(lexer, "\"") || scan_quoted_string(lexer, "'")) {
                    lexer->result_symbol = STRING;
                    return true;
                }
                else if(scan_sequence(lexer, "--")) {
                    while(iswspace(lexer->lookahead) && lexer->lookahead != '\n' && lexer->lookahead != 0) {
                        advance(lexer);
                    }

                    lexer->result_symbol = COMMENT;

                    if(!scan_multiline_content(lexer)) {
                        while(lexer->lookahead != '\n' && lexer->lookahead != 0) {
                            // Consume any character that isn't new line neither end of file (eof)
                            advance(lexer);
                        }
                    }

                    return true;
                }
                else if(scan_multiline_content(lexer)) {
                    lexer->result_symbol = STRING;

                    return true;
                }

                return false;
            }

            return false;
        }
    };

}

extern "C" {

    void *tree_sitter_luau_external_scanner_create() {
        return new Scanner();
    }

    void tree_sitter_luau_external_scanner_destroy(void *payload) {
        Scanner *scanner = static_cast<Scanner *>(payload);
        delete scanner;
    }

    bool tree_sitter_luau_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid_symbols) {
        Scanner *scanner = static_cast<Scanner *>(payload);
        return scanner->scan(lexer, valid_symbols);
    }

    unsigned tree_sitter_luau_external_scanner_serialize(void *payload, char *buffer) {
        return 0;
    }

    void tree_sitter_luau_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {}

}
