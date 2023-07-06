module.exports = {
    root: true,
    parser: "@typescript-eslint/parser",
    parserOptions: {
        // project: 'tsconfig.json',
        tsconfigRootDir: __dirname,
        ecmaVersion: 6,
        sourceType: "module"
    },
    plugins: ['@typescript-eslint/eslint-plugin'],
    extends: [
        'plugin:@typescript-eslint/recommended',
        'plugin:prettier/recommended',
    ],
    rules: {
        "@typescript-eslint/naming-convention": "off",
        "@typescript-eslint/semi": "warn",
        "curly": "off",
        "eqeqeq": "warn",
        "no-throw-literal": "warn",
        "semi": "off"
    },
    ignorePatterns: ["out", "dist", "**/*.d.ts"]
}
