const mongoose = require('mongoose');
require('./config/db')

const express = require('express')
const exphbs = require('express-handlebars')
const router = require('./routes')
const path = require('path')
const cookieParser = require('cookie-parser')
const session = require('express-session')
const MongoStore = require('connect-mongo')
const bodyParser = require('body-parser')
const expressValidator = require('express-validator')
const flash = require('connect-flash')
const createError = require('http-errors')
const passport = require('./config/passport')

require('dotenv').config({path: 'variables.env'})

const app = express()

//habilitar body-parser
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended:true}))

//validacion de campos
app.use(expressValidator())

//habilitar handlebars como view
app.engine('handlebars', 
    exphbs.engine({
        defaultLayout: 'layout',
        helpers: require('./helpers/handlebars')
    })
)

app.set('view engine', 'handlebars')

//static files
app.use(express.static(path.join(__dirname, 'public')))

app.use(cookieParser())

app.use(session({
    secret: process.env.SECRETO,
    key: process.env.KEY,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.DATABASE
    })
}))

//inicializar passport
app.use(passport.initialize())
app.use(passport.session())

//alertas y flash messages
app.use(flash())

//crea nuestro middleware
app.use((req, res, next) => {
    res.locals.mensajes = req.flash()
    next()
})

app.use('/', router())

//404 pagina no existe 
app.use((req, res, next) => {
    next(createError(404, 'No Encontrado'))
})

//Administracion de los errores 
app.use((error, req, res, next) => {
    res.locals.mensaje = error.message
    const status = error.status || 500
    res.locals.status = status
    res.status(status)

    res.render('error');
})

//dejar que heroku asigne el puerto
const host = '0.0.0.0';
const port = process.env.port



app.listen(port, host, () => {
    console.log('El servidor esta corriendo');
})