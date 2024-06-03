import js from '@eslint/js';
import globals from 'globals';

export default [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 13,
            globals: {
                ...globals.node
            }
        }
    }
];
