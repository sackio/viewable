var Async = require('async')
  , _ = require('underscore')
  , Belt = require('jsbelt')
  , Path = require('path')
  , FS = require('fs');

(function(){

  var Viewable = function(o){
    o = _.defaults(o || {}, {
      //paths
      'watch': true
    , 'locals': {}
    , 'js_locals': []
    });

    var self = this;

    self['views'] = {};
    self['templates'] = {};
    self['locals'] = o.locals;
    self['js_locals'] = o.js_locals;

    self['loadView'] = function(path, watch){
      var name = path.split(Path.sep).pop().replace(/\.(html|ejs)$/i, '');
      self.views[name] = FS.readFileSync(path).toString('utf8');
      self.templates[name] = _.template(self.views[name]);

      if (watch) FS.watch(path, {
        'persistent': false
      }, function(event, file){
        var n = path.split(Path.sep).pop().replace(/\.(html|ejs)$/i, '');
        self.loadView(path, self.views[n] ? false : watch);
      });
    };

    self['render'] = function(view, locals){
      var data = _.extend({}, {
        'Locals': _.extend({}, self.locals || {}, locals || {})
      , 'Render': function(v, locs){
          locs = locs || data.Locals;
          locs['Render'] = locs.Render || data.Render;
          _.each(self.locations, function(v, k){
            locs[k] = !Belt.isNull(locs[k]) ? locs[k] : data.Locals[k];
          });
          locs['Locals'] = locs;

          return self.templates[v](locs);
        }
      }, self.locals || {}, locals || {});

      return self.templates[view](data);
    };

    self['renderViewsJs'] = function(options, callback){
      var a = Belt.argulint(arguments)
        , self = this
        , gb = {};
      a.o = _.defaults(a.o, {
        //views_filter
      });

      var filtered_views = _.pick(self.views, function(v, k){
        return a.o.views_filter ? a.o.views_filter(v, k) : true;
      });

      var js = 'var Render = function(view, locals){\n'
             + '  locals = locals || window;\n';

      js += _.map(self.js_locals, function(l){
        return '  locals["' + l + '"] = locals["' + l + '"] || ' + l + ';';
      }).join('\n');

      js += '  locals.Render = locals.Render || Render;\n';

      js += '\n  return Templates[view](locals);\n'
          + '};\n'
          + '\n'
          + 'var Views = typeof Views !== "undefined" ? Views : {};\n'
          + '_.extend(Views, {\n';

      var count = 0;
      js += _.map(filtered_views, function(v, k){
              return (count++ ? ',' : ' ') + ' "' + k + '": (' + Belt.stringify(v.split(/\n+|\r+/)) + '.join("\\n"))\n';
            }).join('\n');

      js += '});';

      js += '\n'
          + 'var Templates = typeof Templates !== "undefined" ? Templates || {};\n'
          + '_.extend(Templates, {\n';

      count = 0;
      js += _.map(filtered_views, function(v, k){
              return (count++ ? ',' : ' ') + ' "' + k + '": _.template(' + Belt.stringify(v.split(/\n+|\r+/)) + '.join("\\n"))\n';
            }).join('\n');

      js += '});';

      return js;
    };

    _.each(o.paths, function(p){
      try {
        var stat = FS.statSync(p)
          , paths = [];
      } catch(e) {
        return;
      }

      if (stat.isDirectory()){
        if (o.watch) FS.watch(p, {
          'persistent': false
        }, function(event, file){
          var n = file.split(Path.sep).pop();
          self.loadView(Path.join(p, Path.sep + file), self.views[n] ? false : o.watch);
        });

        _.chain(FS.readdirSync(p))
         .reject(function(p2){
           return FS.statSync(Path.join(p, '/' + p2)).isDirectory();
         })
         .each(function(p2){
            paths.push(Path.join(p, '/' + p2));
          });
      } else {
        paths.push(p);
      }

      _.each(paths, function(p2){
        self.loadView(p2, o.watch);
      });
    });

    return self;
  };

  module.exports = Viewable;

}.call());
