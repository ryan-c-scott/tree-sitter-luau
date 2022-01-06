;; zig build-lib -I src/ src/parser.c src/scanner.cc -dynamic --library c++ --name luau

(defun luau-tree-sitter-setup ()
  (interactive)
  (setq tree-sitter-hl-default-patterns "
(STRING) @string
(NUMBER) @number
(comment) @comment

(binding (NAME) @variable (Type) @type)
(ReturnType) @type
(functioncall (NAME) @function.call !method)
(functioncall method: (NAME) @method.call)
(functioncall (prefixexp (var) @function.call))
(funcname) @function
(stat function_local: (NAME) @function)
(exp (prefixexp (var) @variable.parameter))
(tableconstructor [\"{\" \"}\"] @property)
(binop) @operator
(unop) @operator

(ERROR) @comment

(laststat [\"return\" \"break\" \"continue\"] @keyword)
(stat export: \"export\" @constant \"type\" @keyword (NAME) @type)

[\"end\" \"or\" \"for\" \"in\" \"and\" \"else\" \"elseif\" \"do\" \"then\" \"function\" \"if\" \"return\" \"local\"] @keyword
")
  (add-to-list 'tree-sitter-major-mode-language-alist '(lua-mode . luau))
  (tree-sitter-require 'luau))

(add-hook 'lua-mode-hook 'luau-tree-sitter-setup)
