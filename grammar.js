module.exports = grammar({
  name: 'luau',

  extras: $ => [/[\n]/, /\s/, $.comment],

  rules: {
    source_file: $ => repeat($.block),

    // NOTE: Changed to choice to make only single laststat identify as such and not as a function call
    block: $ => prec.right(seq(repeat1(seq(choice($.stat, $.laststat), optional(';'))))),

    // NOTE: Unspecified in spec
    NAME: $ => /[a-zA-Z_][a-zA-Z0-9_]*/,
    STRING: $ => choice(/"(\\.|[^\"])*"/, /'(\\.|[^\'])*'/),
    comment: ($) => seq("--", /.*\r?\n/),
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
    laststat: $ => prec.right(choice(seq('return', optional($.explist)), 'break', 'continue')),
    stat: $ => prec.left(choice(
      field('binding', seq($.varlist, '=', $.explist)),
      field('op', seq($.var, $.compoundop, $.exp)),
      $.functioncall,
      field('do_block', seq('do', optional($.block), 'end')),
      field('loop_while', seq('while', $.exp, 'do', optional($.block), 'end')),
      field('loop_repeat', seq('repeat', optional($.block), 'until', $.exp)),
      field('if', seq('if', $.exp, 'then', optional($.block), repeat(seq('elseif', $.exp, 'then', optional($.block))), optional(seq('else', optional($.block))), 'end')),
      field('loop_for_range', seq('for', $.binding, '=', $.exp, ',', $.exp, optional(seq(',', $.exp)), 'do', optional($.block), 'end')),
      field('loop_for', seq('for', $.bindinglist, 'in', $.explist, 'do', optional($.block), 'end')),
      field('function', seq('function', $.funcname, $.funcbody)),
      field('function_local', seq('local', 'function', $.NAME, $.funcbody)),
      field('binding_local', seq('local', $.bindinglist, optional(seq('=', $.explist)))),
      field('export', seq(optional('export'), 'type', $.NAME, optional(seq('<', $.GenericTypeList, '>')), '=', $.Type))
    )),

    funcname: $ => seq($.NAME, repeat(seq('.', $.NAME)), optional(seq(':', $.Type))),
    funcbody: $ => seq('(', optional($.parlist), ')', optional(seq(':', $.ReturnType)), optional($.block), 'end'),
    parlist: $ => choice(seq($.bindinglist, optional(seq(',', '...'))), '...'),
    explist: $ => seq(repeat(seq($.exp, ',')), $.exp),
    namelist: $ => seq($.NAME, repeat(seq(',', $.NAME))),
    binding: $ => seq($.NAME, optional(seq(':', $.Type))),
    bindinglist: $ => prec.right(seq($.binding, optional(seq(',', $.bindinglist)))),
    var: $ => choice($.NAME, seq($.prefixexp, '[', $.exp, ']'), seq($.prefixexp, '.', $.NAME)),
    varlist: $ => seq($.var, repeat(seq(',', $.var))),
    prefixexp: $ => choice($.var, prec(3, $.functioncall), seq('(', $.exp, ')')),
    functioncall: $ => choice(seq($.prefixexp, $.funcargs), seq($.prefixexp, ':', $.NAME, $.funcargs)),

    exp: $ => prec.right(seq(choice($._asexp, seq($.unop, $.exp)), repeat(seq($.binop, $.exp)))),
    ifelseexp: $ => seq('if', $.exp, 'then', $.exp, repeat(seq('elseif', $.exp, 'then', $.exp)), 'else', $.exp),
    _asexp: $ => prec.right(seq($._simpleexp, optional(seq('::', $.Type)))),
    _simpleexp: $ => prec.right(choice($.NUMBER, $.STRING, 'nil', 'true', 'false', '...', $.tableconstructor, seq('function', $.funcbody), $.prefixexp, $.ifelseexp)),
    funcargs: $ => choice(seq('(', optional($.explist), ')'), $.tableconstructor, $.STRING),
    tableconstructor: $ => seq('{', optional($.fieldlist), '}'),
    fieldlist: $ => seq($.field, repeat(seq($.fieldsep, $.field)), optional($.fieldsep)),
    field: $ => choice(seq('[', $.exp, ']', '=', $.exp), seq($.NAME, '=', $.exp), $.exp),
    fieldsep: $ => choice(',', ';'),
    compoundop: $ => choice('+=', '-=', '*=', '/=', '%=', '^=', '..='),
    binop: $ => choice('+', '-', '*', '/', '^', '%', '..', '<', '<=', '>', '>=', '==', '~=', 'and', 'or'),
    unop: $ => choice('-', 'not', '#'),

    SimpleType: $ => prec.right(choice(
      'nil',
      seq($.NAME, optional(seq('.', $.NAME)), optional(seq('<', $.TypeList, '>'))),
      seq('typeof', '(', $.exp, ')'),
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
