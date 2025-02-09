var express  = require('express');
var router = express.Router();
var multer = require('multer');
var upload = multer({ dest: 'uploadedFiles/' });
var Post = require('../models/Post');
var User = require('../models/User');
var Comment = require('../models/Comment');
var File = require('../models/File');
var util = require('../util');

var fs = require("fs");
var ipfsAPI = require('ipfs-api');
var sdk = require('../sdk/sdk')
const ipfs = ipfsAPI('127.0.0.1', '5001', {protocol: 'http'})

// Index
router.get('/', async function(req, res){
  var page = Math.max(1, parseInt(req.query.page)); // query string으로 전달 받은 page, limit를 req.query로 받는다.
  var limit = Math.max(1, parseInt(req.query.limit)); //page limit가 양수여야 하기때문에 max 사용
  page = !isNaN(page)?page:1;
  limit = !isNaN(limit)?limit:10;

  var skip = (page-1)*limit; // 무시할 게시물의 수 -> 20개의 개시물을 10개씩 표시하고자 할때 뒤에 10개를 무시하는 용도로 사용
  var maxPage = 0;
  var searchQuery = await createSearchQuery(req.query);
  var posts = [];

  if(searchQuery) {
    var count = await Post.countDocuments(searchQuery); //post의 DB를 읽은 후 수를 반환
    maxPage = Math.ceil(count/limit);
    posts = await Post.aggregate([
      { $match: searchQuery },
      { $lookup: {
          from: 'users',
          localField: 'author',
          foreignField: '_id',
          as: 'author'
      } },
      { $unwind: '$author' },
      { $sort : { createdAt: -1 } }, //나중에 생성된것이 뒤로 오도록 정렬
      { $skip: skip },
      { $limit: limit },
      { $lookup: {
          from: 'comments',
          localField: '_id',
          foreignField: 'post',
          as: 'comments'
      } },
      { $lookup: {
          from: 'files',
          localField: 'attachment',
          foreignField: '_id',
          as: 'attachment'
      } },
      { $unwind: {
        path: '$attachment',
        preserveNullAndEmptyArrays: true
      } },
      { $project: {
          title: 1,
          author: {
            username: 1,
          },
          views: 1,
          assessment: 1,
          attachment: { $cond: [{$and: ['$attachment', {$not: '$attachment.isDeleted'}]}, true, false] },
          createdAt: 1,
          commentCount: { $size: '$comments'}
      } },
    ]).exec();
  }

  res.render('posts/index', {
    posts:posts,
    currentPage:page,
    maxPage:maxPage,
    limit:limit,
    searchType:req.query.searchType,
    searchText:req.query.searchText
  });
});

// New
router.get('/new', util.isLoggedin, function(req, res){
  var post = req.flash('post')[0] || {};
  var errors = req.flash('errors')[0] || {};
  res.render('posts/new', { post:post, errors:errors, });
});

// create
router.post('/', util.isLoggedin, upload.single('attachment'), async function(req, res){

  if(req.file){
    try{
      fs.readFileSync('./uploadedFiles/'+req.file.filename, 'utf8')
    }catch(err){
      return res.json(err);
    }
    var user_file = fs.readFileSync('./uploadedFiles/'+req.file.filename, 'utf8')
    var file_buffer = Buffer.from(user_file); //new Buffer -> Buffer.from
    var ipfs_hash


    //upload file to ipfs
    ipfs.files.add(file_buffer, (err,file)=>{
      if(err) {
          console.log(err);
      }  
      
      var alias = req.body.malwareName
      var categories = req.body.categories
      var submission = req.body.submission.toString()
      var url = req.body.url
      var risk = req.body.assessment.toString()
      var uploader_ID = req.user.username.toString()
      ipfs_hash = file[0].hash.toString()
      var args = [alias, categories, submission, url, risk, uploader_ID, ipfs_hash]

      console.log(req.body)
      //req.body.hash = ipfs_hash

      sdk.send(true, 'setCode', args)
    })
  }
  
  var attachment;

  try{
    attachment = req.file?await File.createNewInstance(req.file, req.user._id):undefined;
  }
  catch(err){
    return res.json(err);
  }

  req.body.attachment = attachment;
  req.body.author = req.user._id;
  req.body.hash = ipfs_hash;

  Post.create(req.body, function(err, post){
    if(err){
      req.flash('post', req.body);
      req.flash('errors', util.parseError(err));
      return res.redirect('/posts/new'+res.locals.getPostQueryString());
    }

    res.redirect('/posts'+res.locals.getPostQueryString(false, { page:1, searchText:'' }));
  });
});

// show
router.get('/:id', function(req, res){
  var commentForm = req.flash('commentForm')[0] || { _id: null, form: {} };
  var commentError = req.flash('commentError')[0] || { _id:null, parentComment: null, errors:{} };

  //DB에서 post정보와 comments 정보들을 가져와야 하므로 promise.all 사용
  Promise.all([
      // Model.populate(): relationship이 형성되어 있는 항목의 값을 생성해준다. 현재 post의 author에 user의 id가 기록되어 있다. 이값을 기반으로 실제 user의 값을 author에 전달
      Post.findOne({_id:req.params.id}).populate({ path: 'author', select: 'username' }).populate({path:'attachment',match:{isDeleted:false}}),
      Comment.find({post:req.params.id}).sort('createdAt').populate({ path: 'author', select: 'username' })
    ])
    .then(([post, comments]) => {
      post.views++;
      post.save();
      var commentTrees = util.convertToTrees(comments, '_id','parentComment','childComments');

      var comment_length = 0 //대댓글은 평가 기능이 없기 때문에 comments.length 사용 불가
      var total_score = 0

      comments.forEach((comment)=>{
        if (comment.risk == "Dangerous"){
          var score = 5;
          comment_length += 1;
        }else if (comment.risk == "Warning"){
          var score = 3;
          comment_length += 1;
        }else if (comment.risk == "Normal"){
          var score = 1;
          comment_length += 1;
        }else if (comment.risk == "Safe"){
          var score = 0;
          comment_length += 1;
        }else if (comment.risk == "none"){
          var score = 0;
        }
        total_score += score
      })

      if (total_score > 0){
        post.riskScore = total_score/comment_length
      }else{
        post.riskScore = 0
      }

      res.render('posts/show', { post:post, commentTrees:commentTrees, commentForm:commentForm, commentError:commentError});
    })
    .catch((err) => {
      return res.json(err);
    });
});

// edit
router.get('/:id/edit', util.isLoggedin, checkPermission, function(req, res){
  var post = req.flash('post')[0];
  var errors = req.flash('errors')[0] || {};
  if(!post){
    Post.findOne({_id:req.params.id})
      .populate({path:'attachment',match:{isDeleted:false}})
      .exec(function(err, post){
        if(err) return res.json(err);
        res.render('posts/edit', { post:post, errors:errors });
      });
  }
  else {
    post._id = req.params.id;
    res.render('posts/edit', { post:post, errors:errors });
  }
});

// update
router.put('/:id', util.isLoggedin, checkPermission, /*upload.single('newAttachment'),*/ async function(req, res){
  var post = await Post.findOne({_id:req.params.id}).populate({path:'attachment',match:{isDeleted:false}});
  if(post.attachment && (req.file || !req.body.attachment)){
    post.attachment.processDelete();
  }
  try{
    req.body.attachment = req.file?await File.createNewInstance(req.file, req.user._id, req.params.id):post.attachment;
  }
  catch(err){
    return res.json(err);
  }
  req.body.updatedAt = Date.now();
  // {runValidators:true}: findOneAndUpdate 기본설정이 schema에 있는 validation을 작동하지 않기때문에 option을 통해 validatoin이 작동하도록 설정
  Post.findOneAndUpdate({_id:req.params.id}, req.body, {runValidators:true}, function(err, post){
    if(err){
      req.flash('post', req.body);
      req.flash('errors', util.parseError(err));
      return res.redirect('/posts/'+req.params.id+'/edit'+res.locals.getPostQueryString());
    }
    res.redirect('/posts/'+req.params.id+res.locals.getPostQueryString());
  });
});

// destroy
router.delete('/:id', util.isLoggedin, checkPermission, function(req, res){
  Post.deleteOne({_id:req.params.id}, function(err){
    if(err) return res.json(err);
    res.redirect('/posts'+res.locals.getPostQueryString());
  });
});

module.exports = router;

// private functions
function checkPermission(req, res, next){
  Post.findOne({_id:req.params.id}, function(err, post){
    if(err) return res.json(err);
    if(post.author != req.user.id) return util.noPermission(req, res);

    next();
  });
}

async function createSearchQuery(queries){
  var searchQuery = {};
  if(queries.searchType && queries.searchText && queries.searchText.length >= 3){
    var searchTypes = queries.searchType.toLowerCase().split(',');
    var postQueries = [];
    if(searchTypes.indexOf('title')>=0){
      postQueries.push({ title: { $regex: new RegExp(queries.searchText, 'i') } });
    }
    if(searchTypes.indexOf('body')>=0){
      postQueries.push({ body: { $regex: new RegExp(queries.searchText, 'i') } });
    }
    if(searchTypes.indexOf('author!')>=0){
      var user = await User.findOne({ username: queries.searchText }).exec();
      if(user) postQueries.push({author:user._id});
    }
    else if(searchTypes.indexOf('author')>=0){
      var users = await User.find({ username: { $regex: new RegExp(queries.searchText, 'i') } }).exec();
      var userIds = [];
      for(var user of users){
        userIds.push(user._id);
      }
      if(userIds.length>0) postQueries.push({author:{$in:userIds}});
    }
    if(postQueries.length>0) searchQuery = {$or:postQueries};
    else searchQuery = null;
  }
  return searchQuery;
}
