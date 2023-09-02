const mongoose = require('mongoose')
const Vacante = mongoose.model('Vacante')

const multer = require('multer')
const shortid = require('shortid')

exports.formularioNuevaVacante = (req, res) => {
    res.render('nueva-vacante', {
        nombrePagina: 'Nueva Vacante',
        tagline: 'Llena el formulario y publica tu vacante',
        cerrarSesion: true,
        nombre: req.user.nombre,
        imagen: req.user.imagen
    })
}

exports.agregarVacante = async (req, res) => {
    const vacante = new Vacante(req.body)
    
    //usuario autor de la vacante
    vacante.autor = req.user._id

    //crear arreglo de habilidades (skills)
    vacante.skills = req.body.skills.split(',')
    
    //almacenarlo en la base de datos
    const nuevaVacante = await vacante.save()

    //redireccionar
    res.redirect(`/vacantes/${nuevaVacante.url}`)
}

//muestra vacante
exports.mostrarVacante = async (req, res, next) => {
    const vacante = await Vacante.findOne({url: req.params.url}).lean().populate('autor')

    //si no hay resultados
    if(!vacante) return next()

    res.render('vacante', {
        vacante,
        nombrePagina :  vacante.titulo,
        barra: true
    })
}

exports.formEditarVacante = async (req, res, next) => {
    const vacante = await Vacante.findOne({url: req.params.url}).lean()

    //si no hay resultados
    if(!vacante) return next();

    res.render('editar-vacante', {
        vacante,
        nombrePagina: `Editar - ${vacante.titulo}`,
        cerrarSesion: true,
        nombre: req.user.nombre,
        imagen: req.user.imagen
    })
}

exports.editarVacante = async (req, res) => {
    const vacanteActulizada = req.body

    vacanteActulizada.skills = req.body.skills.split(',')

    const vacante = await Vacante.findOneAndUpdate({url: req.params.url},
    vacanteActulizada,{
        new: true,
        runValidators: true
    })

    res.redirect(`/vacantes/${vacante.url}`)
}


//validar y sanitizar los campos de las nuevas vacantes
exports.validarVacante = (req, res, next) => {
    //sanitizar los campos
    req.sanitizeBody('titulo').escape()
    req.sanitizeBody('empresa').escape()
    req.sanitizeBody('ubicacion').escape()
    req.sanitizeBody('salario').escape()
    req.sanitizeBody('contrato').escape()
    req.sanitizeBody('skills').escape()

    //validar
    req.checkBody('titulo', 'Agrega un titulo a la Vacante').notEmpty()
    req.checkBody('empresa', 'Agregar una empresa').notEmpty()
    req.checkBody('ubicacion', 'Agrega una ubicacion').notEmpty()
    req.checkBody('contrato', 'Selecciona el Tipo de Contrato').notEmpty()
    req.checkBody('skills', 'Agrega al menos una habilidad').notEmpty()

    const errores = req.validationErrors();

    if(errores) {
        //recargar la vistas con los errores
        req.flash('error', errores.map(error => error.msg))

        res.render('nueva-vacante', {
            nombrePagina: 'Nueva Vacante',
            tagline: 'Llena el formulario y publica tu vacante',
            cerrarSesion: true,
            nombre: req.user.nombre,    
            mensajes: req.flash()       
        })

        return
    }

    next() //siguiente middleware
    
}

exports.eliminarVacante = async(req, res) => {
    const {id} = req.params

    const vacante = await Vacante.findById(id);

    if(verificarAutor(vacante, req.user)){
        //TODO BIEN, SI ES EL USUARIO ELIMINAR
        vacante.deleteOne()
        res.status(200).send('Vacante Eliminada Correctamente')
    }else{
        //NO PERMITIDO
        res.status(403).send('Error')

    }
}

const verificarAutor = (vacante = {}, usuario = {}) => {
    if (!vacante.autor.equals(usuario._id)) {
        return false
    }
    return true
}

//subir archivos en pdf
exports.subirCV = (req, res, next) => {
    upload(req, res, function(error){
        if(error){
            if(error instanceof multer.MulterError){
                if(error.code === 'LIMIT_FILE_SIZE'){
                    req.flash('error', 'El archivo esta muy pesado: maximo 400kb')
                }else{
                    req.flash('error', error.message)
                }
            }else{
                req.flash('error', error.message)
            }

            res.redirect('back')
            return
        }else{
            return next()
        }
    }) 
}

//OPCIONES DE MULTER
const configuracionMulter = {
    limits: {fileSize : 400000},
    storage: fileStorage = multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, __dirname+'../../public/uploads/cv')
        },
        filename: (req, file, cb) => {
            const extension = file.mimetype.split('/')[1]
            cb(null, `${shortid.generate()}.${extension}`);
        }
    }),
    fileFilter(req, file, cb){
        if(file.mimetype === 'application/pdf'){
            //el callback se ejecuta como true o false : true cuando la imagen se acepta
            cb(null, true)
        }else{
            cb(new Error('Formato No Valido'), false)
        }
    }
}

const upload = multer(configuracionMulter).single('cv');

//almacenar los candidatos en la BD
exports.contactar = async(req, res, next) => {
    
    const vacante = await Vacante.findOne({url: req.params.url})

    //sino existe la vacante
    if(!vacante) return next()

    //todo bien, contruir el nuevo objeto
    const nuevoCandidato = {
        nombre: req.body.nombre,
        email: req.body.email,
        cv: req.file.filename
    }

    //almacenar la vacante
    vacante.candidatos.push(nuevoCandidato)
    await vacante.save()

    //mensaje flash y redireccion
    req.flash('correcto', 'Se envio tu Curriculum Correctamente')
    res.redirect('/')
}

//mostrar candidatos
exports.mostrarCandidatos = async(req, res, next) => {
    const vacante = await Vacante.findById(req.params.id).lean()

    if(vacante.autor != req.user._id.toString()){
        return next()
    }

    if(!vacante) return next()

    res.render('candidatos', {
        nombrePagina: `Candidatos Vacante - ${vacante.titulo}`,
        cerrarSesion: true,
        nombre: req.user.nombre,
        imagen: req.user.imagen,
        candidatos: vacante.candidatos
    })
}

//buscador vacantes 
exports.buscarVacantes = async(req, res) => {
    const vacantes = await Vacante.find({
        $text: {
            $search: req.body.q
        }
    }).lean()

    //mostrar vacantes
    res.render('home', {
        nombrePagina: `Resultados para la busqueda: ${req.body.q}`,
        barra: true,
        vacantes
    })
}