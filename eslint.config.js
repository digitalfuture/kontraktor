/** @type {import('eslint').Linter.FlatConfig[]} */

// Local plugin: no hardcoded Indonesian strings in routes/middleware
const localPlugin = {
  rules: {
    'no-hardcoded-id-strings': {
      meta: {
        type: 'suggestion',
        docs: {
          description: 'Disallow hardcoded Indonesian error strings. Use t() for locale-aware messages instead.',
        },
        messages: {
          hardcoded: 'Hardcoded Indonesian string detected. Use t() for locale-aware error messages instead of raw text.',
        },
        schema: [],
      },
      create(context) {
        const patterns = [
          /tidak\s+(valid|ditemukan|ada)/i,
          /wajib\s+diisi/i,
          /sudah\s+(terdaftar|ada)/i,
          /nomor\s+telepon/i,
          /\bharus\s+nomor\b/i,
          /\bcontoh\b/i,
          /belum\s+(terdaftar|ada|diisi)/i,
          /maaf/i,
          /gagal/i,
          /berhasil/i,
          /simpan/i,
          /perbarui/i,
          /selain\s+itu/i,
          /kategori\s+wajib/i,
          /deskripsi\s+wajib/i,
          /nama\s+wajib/i,
          /telepon\s+wajib/i,
          /email\s+wajib/i,
        ];

        function containsIndonesian(text) {
          return patterns.some(p => p.test(text));
        }

        return {
          Literal(node) {
            if (typeof node.value !== 'string') return;
            // Skip imports, property keys, type annotations
            if (node.parent?.type === 'ImportDeclaration') return;
            if (node.parent?.type === 'Property' && node.parent.key === node) return;
            if (node.parent?.type === 'ExportSpecifier') return;
            if (node.parent?.type?.startsWith('TS')) return;
            if (containsIndonesian(node.value)) {
              context.report({ node, messageId: 'hardcoded' });
            }
          },
          TemplateElement(node) {
            if (containsIndonesian(node.value.raw)) {
              context.report({ node, messageId: 'hardcoded' });
            }
          },
        };
      },
    },
  },
};

module.exports = [
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: require('@typescript-eslint/parser'),
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json',
        tsconfigRootDir: __dirname
      }
    },
    plugins: {
      '@typescript-eslint': require('@typescript-eslint/eslint-plugin')
    },
    rules: {
      // Errors — must fix
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],
      'no-unused-vars': 'off',

      // Warnings — enforce over time
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/explicit-member-accessibility': 'warn',

      // Best practices
      '@typescript-eslint/no-inferrable-types': 'warn',
      '@typescript-eslint/prefer-as-const': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',

      // Quality
      '@typescript-eslint/prefer-readonly': 'warn',
      '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],
      '@typescript-eslint/no-require-imports': 'warn',
    }
  },
  // Separate block: hardcoded Indonesian check in routes/middleware only
  {
    files: ['src/routes/**/*.ts', 'src/middleware/**/*.ts'],
    plugins: { 'local': localPlugin },
    rules: {
      'local/no-hardcoded-id-strings': 'warn',
    },
  },
];
