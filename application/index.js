var express = require('express');
var mongoose = require('mongoose');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var flash = require('connect-flash');
var session = require('express-session');
var passport = require('./config/passport');
var util = require('./util');
var app = express();

const ENV = require("./config/enviroment.js");

// DB setting
//mongoose.connect(process.env.MONGO_DB);
mongoose.connect(ENV.DATABASE, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false,
  useCreateIndex: true,
});
var db = mongoose.connection;
db.once('open', function(){
  console.log('DB connected');
});
db.on('error', function(err){
  console.log('DB ERROR : ', err);
});

// Other settings
// route에 상관없이 request가 올때마다 무조건 실행
app.set('view engine', 'ejs');
app.use(express.static(__dirname+'/public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}));
app.use(methodOverride('_method'));
app.use(flash()); // flash 초기화 req.flash(문자열, 저장할 값)
// 서버에서 접속자를 구분시키는 역할, {}:옵션, secret: sessiondmf hash화 하는데 사용
app.use(session({secret:'MySecret', resave:true, saveUninitialized:true})); 

// Passport
app.use(passport.initialize()); // passport 초기화
app.use(passport.session()); // passport를 session과 연결

// Custom Middlewares
app.use(function(req,res,next){
  //res.local -> ejs에서 사용
  res.locals.isAuthenticated = req.isAuthenticated(); // 로그인 여부 true, false
  res.locals.currentUser = req.user; // req.user 로그인 되면 session으로 부터 user를 deserialize하여 생성한다.
  res.locals.util = util;
  next();
});

// Routes
app.use('/', require('./routes/home'));
app.use('/posts', util.getPostQueryString, require('./routes/posts'));
app.use('/ipfs', require('./routes/ipfs'));
app.use('/users', require('./routes/users'));
app.use('/comments', util.getPostQueryString, require('./routes/comments'));

// Port setting
var port = 3000;
app.listen(port, function(){
  console.log('server on! http://localhost:'+port);
});




