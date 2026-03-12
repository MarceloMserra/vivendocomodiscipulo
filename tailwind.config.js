/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./views/**/*.{handlebars,html,js}", "./public/js/**/*.js"],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Montserrat', 'sans-serif'],
                serif: ['Merriweather', 'serif']
            },
            colors: {
                imbb: {
                    navy: '#0F265C',
                    blue: '#1E40AF',
                    gold: '#C5A059',
                    dark: '#0a0a0a'
                }
            },
            backdropBlur: {
                xs: '2px',
            }
        }
    },
    plugins: [],
}
