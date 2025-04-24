import js from "@eslint/js";

export default [
    js.configs.recommended,
    {
        files: ["src/**/*.js", "public/**/*.js"],
        languageOptions: {
            ecmaVersion: 2021,
            sourceType: "script",
            globals: {
                // Browser globals
                window: "readonly",
                document: "readonly",
                console: "readonly",
                fetch: "readonly",
                URLSearchParams: "readonly",
                confirm: "readonly",
                bootstrap: "readonly",
                
                // Electron globals
                require: "readonly",
                module: "readonly",
                process: "readonly",
                __dirname: "readonly",
                
                // Timer functions
                setTimeout: "readonly",
                clearTimeout: "readonly",
                setInterval: "readonly",
                clearInterval: "readonly"
            }
        },
        rules: {
            "semi": ["error", "always"],
            "quotes": ["error", "double"],
            "indent": ["error", 4],
            "no-unused-vars": ["warn"],
            "no-console": ["off"],
            "no-undef": ["error"],
            "no-redeclare": ["error"],
            "no-var": ["error"],
            "prefer-const": ["error"],
            "template-curly-spacing": ["error", "never"],
            "no-template-curly-in-string": ["error"]
        }
    }
]; 