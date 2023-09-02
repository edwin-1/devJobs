const passport = require('passport')
const mongoose = require('mongoose')
const Vacante = mongoose.model('Vacante')
const Usuarios = mongoose.model('Usuarios')
const crypto = require('crypto')
const enviarEmail = require('../handlebars/email')

exports.autenticarUsuario = passport.authenticate('local', {
    successRedirect: '/administracion',
    failureRedirect: '/iniciar-sesion',
    failureFlash: true,
    badRequestMessage: 'Ambos campos son obligatorios'
})

//revisar si el usuario esta autenticado o no
exports.verificarUsuario = (req, res, next) => {

    //revisar el usuarip
    if(req.isAuthenticated()){
        return next() //estan auntenticados
    }

    //redireccionar
    res.redirect('/iniciar-sesion')
}

exports.mostrarPanel = async(req, res) => { 

    //consultar el usuario autenticacion
    const vacantes = await Vacante.find({autor: req.user._id}).lean()

    res.render('administracion', {
        nombrePagina: 'Panel de Administracion',
        tagline: 'Crea y administra tus vacantes desde aqui',
        cerrarSesion: true,
        nombre: req.user.nombre,
        imagen:  req.user.imagen,
        vacantes

    })
}


exports.cerrarSesion = (req, res) => {
    req.logout(function(err){
        if(err){
            return next(err);
        }

        req.flash('correcto', 'Cerraste Sesion Correctamente')
        return res.redirect('/iniciar-sesion')
    })
}

//formulario para reiniciar el password
exports.formReestablecerPassword = (req, res) => {
    res.render('reestablecer-password', {
        nombrePagina: 'Reestablece tu Password',
        tagline: 'Si ya tienes una cuenta pero olvidaste tu password, coloca tu email'
    })
}

exports.enviarToken = async(req, res, next) => {
    const usuario = await Usuarios.findOne({email: req.body.email})

    if(!usuario){
        req.flash('error', 'No existe esa cuenta')
        return res.redirect('/iniciar-sesion')
    }

    //el usuario existe generar token
    usuario.token = crypto.randomBytes(20).toString('hex')
    usuario.expira = Date.now() + 3600000

    //guardar el usuario
    await usuario.save()
    const resetUrl = `http://${req.headers.host}/reestablecer-password/${usuario.token}`

    //console.log(resetUrl);

    //TODO : ENVIAR notificaciones por email
    await enviarEmail.enviar({
        usuario,
        subject: 'Password Reset',
        resetUrl,
        archivo: 'reset'
    })

    req.flash('correcto', 'Revisa tu email para las indicaciones')
    res.redirect('/iniciar-sesion')
}

exports.reestablecerPassword = async(req, res) => {
    const usuario = await Usuarios.findOne({
        token: req.params.token,
        expira: {
            $gt: Date.now()
        }
    })

    if(!usuario){
        req.flash('error', 'El formulario ya no es valido, intenta de nuevo')
        return res.redirect('/reestablecer-password')
    }

    //todo bien, mostrar el formulario
    res.render('nuevo-password', {
        nombrePagina: 'Nuevo Password'
    })
}

//almacena el nuevo password en la BD
exports.guardarPassword = async(req, res) => {
    const usuario = await Usuarios.findOne({
        token: req.params.token,
        expira: {
            $gt: Date.now()
        }
    })

    //no existe el usuario password o el token es invalido
    if(!usuario){
        req.flash('error', 'El formulario ya no es valido,r intenta de nuevo')
        return res.redirect('/reestablecer-password')
    }

    //asignar nuevo password, limpiar valores previos
    usuario.password = req.body.password
    usuario.token = undefined
    usuario.expira = undefined

    //agregar y eliminar valores del objeto
    await usuario.save()

    //redirigir
    req.flash('correcto', 'Password Modificado Correctamente')
    res.redirect('/iniciar-sesion')
}