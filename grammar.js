module.exports = grammar({
  name: 'luau',

  externals: $ => [
    $.comment,
    $.STRING,
  ],

  extras: $ => [/[\n]/, /\s/, $.comment],

  rules: {
    source_file: $ => prec.right(seq(repeat1(seq(choice($._stat, $._laststat), optional(';'))))),
    _block: $ => prec.right(seq(repeat1(seq(choice($._stat, $._laststat), optional(';'))))),

    // NOTE: Unspecified in spec
    NAME: $ => /[a-zA-Z_][a-zA-Z0-9_]*/,
    NUMBER: $ => {
      const decimal_digits = /[0-9]+/
      const signed_integer = seq(optional(choice('-', '+')), decimal_digits)
      const decimal_exponent_part = seq(choice('e', 'E'), signed_integer)

      const decimal_integer_literal = choice(
        '0',
        seq(optional('0'), /[1-9]/, optional(decimal_digits))
      )

      const hex_digits = /[a-fA-F0-9]+/
      const hex_exponent_part = seq(choice('p', 'P'), signed_integer)

      const decimal_literal = choice(
        seq(decimal_integer_literal, '.', optional(decimal_digits), optional(decimal_exponent_part)),
        seq('.', decimal_digits, optional(decimal_exponent_part)),
        seq(decimal_integer_literal, optional(decimal_exponent_part))
      )

      const hex_literal = seq(
        choice('0x', '0X'),
        hex_digits,
        optional(seq('.', hex_digits)),
        optional(hex_exponent_part)
      )

      return token(choice(
        decimal_literal,
        hex_literal
      ))
    },

    //
    _laststat: $ => prec.right(choice(seq('return', optional($._explist)), 'break', 'continue')),
    _stat: $ => prec.left(choice(
      field('binding', seq($._varlist, '=', $._explist)),
      $.op,
      $.functioncall,
      $.do_block,
      $.loop_while,
      $.loop_repeat,
      $.if,
      $.loop_for_range,
      $.loop_for,
      $.function,
      $.function_local,
      $._binding_local,
      $.type_definition,
      $.comment,
    )),

    op: $ => seq($.var, $.compoundop, $._exp),

    do_block: $ => seq('do', optional($._block), 'end'),
    loop_while: $ => seq('while', $._exp, 'do', optional($._block), 'end'),
    loop_repeat: $ => seq('repeat', optional($._block), 'until', $._exp),
    if: $ => seq('if', $._exp, 'then', optional($._block), repeat(seq('elseif', $._exp, 'then', optional($._block))), optional(seq('else', optional($._block))), 'end'),
    loop_for_range: $ => seq('for', $.binding, '=', $._exp, ',', $._exp, optional(seq(',', $._exp)), 'do', optional($._block), 'end'),
    loop_for: $ => seq('for', $._bindinglist, 'in', $._explist, 'do', optional($._block), 'end'),
    function: $ => seq('function', $.funcname, $.funcbody),
    function_local: $ => seq('local', 'function', $.NAME, $.funcbody),
    _binding_local: $ => seq('local', $._bindinglist, optional(seq('=', $._explist))),


    type_definition: $ => seq(optional('export'), 'type', field('type_name', $.NAME), optional(seq('<', $.GenericTypeList, '>')), '=', $.Type),

    require: $ => seq("require", "(", field('module', $._exp), ")"),
    funcname: $ => seq($.NAME, repeat(seq('.', $.NAME)), optional(seq(':', $.Type))),
    funcbody: $ => seq('(', optional($._parlist), ')', optional(seq(':', $.ReturnType)), optional($._block), 'end'),
    _parlist: $ => choice(seq($._bindinglist, optional(seq(',', '...'))), '...'),
    _explist: $ => seq(repeat(seq($._exp, ',')), $._exp),
    binding: $ => seq($.NAME, optional(seq(':', $.Type))),
    _bindinglist: $ => prec.right(seq($.binding, optional(seq(',', $._bindinglist)))),
    var: $ => choice($.NAME, seq($._prefixexp, '[', $._exp, ']'), seq($._prefixexp, '.', $.NAME)),
    _varlist: $ => seq($.var, repeat(seq(',', $.var))),
    _prefixexp: $ => choice($.var, prec(3, $.functioncall), seq('(', $._exp, ')')),
    functioncall: $ => choice(seq($._prefixexp, $.funcargs), field('method', seq($._prefixexp, ':', $.NAME, $.funcargs))),

    _exp: $ => prec.left(choice($.require,
                               seq(choice($._asexp, seq($.unop, $._exp)),
                                   optional(repeat1(seq($.binop, $._exp)))))),

    ifelseexp: $ => seq('if', $._exp, 'then', $._exp, repeat(seq('elseif', $._exp, 'then', $._exp)), 'else', $._exp),
    _asexp: $ => prec.right(seq($._simpleexp, optional(seq('::', $.Type)))),
    _simpleexp: $ => prec.right(choice($.NUMBER, $.STRING, 'nil', 'true', 'false', '...', $.tableconstructor, seq('function', $.funcbody), $._prefixexp, $.ifelseexp)),
    funcargs: $ => choice(seq('(', optional($._explist), ')'), $.tableconstructor, $.STRING),
    tableconstructor: $ => seq('{', optional($.fieldlist), '}'),
    fieldlist: $ => seq($.field, repeat(seq($.fieldsep, $.field)), optional($.fieldsep)),
    field: $ => choice(seq('[', $._exp, ']', '=', $._exp), seq($.NAME, '=', $._exp), $._exp),
    fieldsep: $ => choice(',', ';'),
    compoundop: $ => choice('+=', '-=', '*=', '/=', '%=', '^=', '..='),
    binop: $ => choice('+', '-', '*', '/', '^', '%', '..', '<', '<=', '>', '>=', '==', '~=', 'and', 'or'),
    unop: $ => choice('-', 'not', '#'),

    SimpleType: $ => prec.right(choice(
      'nil',
      seq($.NAME, optional(seq('.', $.NAME)), optional(seq('<', $.TypeList, '>'))),
      seq('typeof', '(', $._exp, ')'),
      $.TableType,
      $.FunctionType)),

    Type: $ => prec.right(choice(
      seq($.SimpleType, optional('?')),
      seq($.SimpleType, optional(seq('|', $.Type))),
      seq($.SimpleType, optional(seq('&', $.Type))))),

    GenericTypeList: $ => seq($.NAME, optional('...'), repeat(seq(',', $.NAME, optional('...')))),
    TypeList: $ => choice(seq($.Type, optional(seq(',', $.TypeList))), seq('...', $.Type)),
    ReturnType: $ => choice($.Type, seq('(', $.TypeList, ')')),
    TableIndexer: $ => seq('[', $.Type, ']', ':', $.Type),
    TableProp: $ => seq($.NAME, ':', $.Type),
    TablePropOrIndexer: $ => choice($.TableProp, $.TableIndexer),
    PropList: $ => seq($.TablePropOrIndexer, repeat(seq($.fieldsep, $.TablePropOrIndexer)), optional($.fieldsep)),
    TableType: $ => seq('{', $.PropList, '}'),
    FunctionType: $ => seq(optional(seq('<', $.GenericTypeList, '>')), '(', optional($.TypeList), ')', '->', $.ReturnType),
  }
});
