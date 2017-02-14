(function($) {
  $.OsdRegionDrawTool = function(options) {
    jQuery.extend(this, {
      osdViewer: null,
      parent: null,
      osd: null,
      list: null,
      annotationsToShapesMap: {},
      eventEmitter: null
    }, options);

    this.eventsSubscriptions = [];

    this.init();
  };

  $.OsdRegionDrawTool.prototype = {

    init: function() {
      this.svgOverlay = this.osdViewer.svgOverlay(this.osdViewer.id, this.windowId, this.state, this.eventEmitter);
      this.svgOverlay.show();
      this.svgOverlay.disable();

      this.listenForActions();
    },

    enterDisplayAnnotations: function() {
      this.svgOverlay.setMouseTool();
      
      // if a user selected the pointer mode but is still actively
      // working on an annotation, don't re-render
      if (!this.svgOverlay.inEditOrCreateMode) {
        this.exitEditMode(true);
        this.render();
      } else {
        this.svgOverlay.checkToRemoveFocus();
      }
    },

    enterCreateAnnotation: function() {
      // if a user selected went from pointer to a shape but is still actively
      // working on an annotation, don't re-render
      if (!this.svgOverlay.inEditOrCreateMode) {
        this.osdViewer.setMouseNavEnabled(false);
        this.svgOverlay.show();
        this.svgOverlay.enable();
        this.render();
      } else {
        this.svgOverlay.checkToRemoveFocus();
      }
    },

    enterCreateShape: function() {
      if (!this.svgOverlay.inEditOrCreateMode) {
        this.osdViewer.setMouseNavEnabled(false);
        this.svgOverlay.show();
        this.svgOverlay.enable();
      } else {
        this.svgOverlay.checkToRemoveFocus();
      }
    },

    enterEditAnnotation: function() {
      this.osdViewer.setMouseNavEnabled(false);
      this.svgOverlay.show();
      this.svgOverlay.enableEdit();
    },

    enterDefault: function() {
      // Removing the Tool explicitly because otherwise mouse events keep
      // firing in default mode where they shouldn't.
      this.svgOverlay.removeMouseTool();

      this.exitEditMode(false);
    },

    exitEditMode: function(showAnnotations) {
      this.osdViewer.setMouseNavEnabled(true);
      this.svgOverlay.disable();
      if (showAnnotations) {
        this.svgOverlay.show();
      } else {
        this.svgOverlay.hide();
      }
    },

    render: function () {

      if(this.parent.mode !== $.AnnotationsLayer.DISPLAY_ANNOTATIONS){
        return ;
      }
      this.svgOverlay.restoreEditedShapes();
      this.svgOverlay.paperScope.activate();
      this.svgOverlay.paperScope.project.clear();
      var _this = this;
      _this.annotationsToShapesMap = {};
      var strategies = [
        new $.Mirador21Strategy(),
        new $.LegacyOpenAnnotationStrategy(),
        new $.MiradorLegacyStrategy(),
        new $.MiradorDualStrategy()
      ];

      for (var i = 0; i < this.list.length; i++) {
        var shapeArray;
        var annotation = this.list[i];
        if (typeof annotation === 'object' && annotation.on) {
          var j;
          for (j = 0; j < strategies.length; j++) {
            if (strategies[j].isThisType(annotation)) {
              shapeArray = strategies[j].parseRegion(annotation, _this);
              break;
            }
          }
          if (j === strategies.length) continue;
        }
        
        _this.svgOverlay.restoreLastView(shapeArray);
        _this.annotationsToShapesMap[annotation['@id']] = shapeArray;
      }

      var windowElement = _this.state.getWindowElement(_this.windowId);
      this.annoTooltip = new $.AnnotationTooltip({
        targetElement: jQuery(this.osdViewer.element),
        state: _this.state,
        eventEmitter: _this.eventEmitter,
        windowId: _this.windowId
      });
      this.annoTooltip.initializeViewerUpgradableToEditor({
        container: windowElement,
        viewport: windowElement,
        getAnnoFromRegion: _this.getAnnoFromRegion.bind(this)
      });
      this.svgOverlay.paperScope.view.draw();
      _this.eventEmitter.publish('annotationsRendered.' + _this.windowId);
    },

    parseRectangle: function(rectString, annotation) {
      var shapeArray = rectString.split('=')[1].split(','),
      shape = {
        'x': parseInt(shapeArray[0]),
        'y': parseInt(shapeArray[1]),
        'width': parseInt(shapeArray[2]),
        'height': parseInt(shapeArray[3])
      };

      return this.svgOverlay.createRectangle(shape, annotation);
    },

    showTooltipsFromMousePosition: function(event, location, absoluteLocation) {
      var _this = this;
      var hitOptions = {
        fill: true,
        stroke: true,
        segments: true
      };
      var hoverColor = this.state.getStateProperty('drawingToolsSettings').hoverColor;
      var hoverFillColor = this.state.getStateProperty('drawingToolsSettings').hoverFillColor;
      var hoverFillColorAlpha = this.state.getStateProperty('drawingToolsSettings').hoverFillColorAlpha;
      var annotationTypeStyles = this.state.getStateProperty('drawingToolsSettings').annotationTypeStyles;
      var annotations = [];
      for (var key in _this.annotationsToShapesMap) {
        if (_this.annotationsToShapesMap.hasOwnProperty(key)) {
          var shapeArray = _this.annotationsToShapesMap[key];
          for (var idx = 0; idx < shapeArray.length; idx++) {
            var shapeTool = this.svgOverlay.getTool(shapeArray[idx]);
            var annoStyle = {
              'hoverColor': hoverColor,
              'hoverFillColor': hoverFillColor,
              'hoverFillColorAlpha': hoverFillColorAlpha
            };
            var hideTooltip = false;
            if (shapeArray[idx].hitTest(location, hitOptions)) {
              if(shapeTool.onHover && !shapeArray[idx].data.hovered){              
                for (var styleKey in annotationTypeStyles) {
                  if (annotationTypeStyles.hasOwnProperty(styleKey) && shapeArray[idx].data.annotation['@type'].includes(styleKey)) {
                    if (typeof annotationTypeStyles[styleKey].hoverColor !== 'undefined') {
                      annoStyle.hoverColor = annotationTypeStyles[styleKey].hoverColor;
                    }
                    if (typeof annotationTypeStyles[styleKey].hoverFillColor !== 'undefined') {
                      annoStyle.hoverFillColor = annotationTypeStyles[styleKey].hoverFillColor;
                    }
                    if (typeof annotationTypeStyles[styleKey].hoverFillColorAlpha !== 'undefined') {
                      annoStyle.hoverFillColorAlpha = annotationTypeStyles[styleKey].hoverFillColorAlpha;
                    }
                    if (typeof annotationTypeStyles[styleKey].hideTooltip !== 'undefined' && annotationTypeStyles[styleKey].hideTooltip) {
                      hideTooltip = true;
                    }
                    break;
                  }
                }
                shapeTool.onHover(true,shapeArray[idx],annoStyle.hoverColor,annoStyle.hoverFillColor,annoStyle.hoverFillColorAlpha);
                if (!hideTooltip) {
                  annotations.push(shapeArray[idx].data.annotation);
                }
              }
            } else {
              shapeTool.onHover(false,shapeArray[idx]);
            }
          }
        }
      }
      this.svgOverlay.paperScope.view.draw();
      //if (_this.svgOverlay.availableExternalCommentsPanel) {
     //   _this.eventEmitter.publish('annotationMousePosition.' + _this.windowId, [annotations]);
      //  return;
      //}
      _this.annoTooltip.showViewer({
        annotations: annotations,
        triggerEvent: event,
        shouldDisplayTooltip: function(api) {
          //track whether the cursor is within the tooltip (with the specified tolerance) and disables show/hide/update functionality.
          if (api.elements.tooltip) {
            var cursorWithinTooltip = true;
            var leftSide = api.elements.tooltip.offset().left - _this.svgOverlay.hitOptions.tolerance;
            var rightSide = api.elements.tooltip.offset().left + api.elements.tooltip.width() + _this.svgOverlay.hitOptions.tolerance;
            if (absoluteLocation.x < leftSide || rightSide < absoluteLocation.x) {
              cursorWithinTooltip = false;
            }
            var topSide = api.elements.tooltip.offset().top - _this.svgOverlay.hitOptions.tolerance;
            var bottomSide = api.elements.tooltip.offset().top + api.elements.tooltip.height() + _this.svgOverlay.hitOptions.tolerance;
            if (absoluteLocation.y < topSide || bottomSide < absoluteLocation.y) {
              cursorWithinTooltip = false;
            }
            return !cursorWithinTooltip;
          }
          return true;
        }
      });
    },

    listenForActions: function() {
      var _this = this;

      this._thisDestroy = function(){
        _this.destroy();
      };

      _this.osdViewer.addHandler('close', this._thisDestroy);

      this.eventsSubscriptions.push(this.eventEmitter.subscribe('DESTROY_EVENTS.'+this.windowId, function(event) {
        _this.destroy();
      }));

      this.eventsSubscriptions.push(_this.eventEmitter.subscribe('updateTooltips.' + _this.windowId, function(event, location, absoluteLocation) {
        if (_this.annoTooltip && !_this.annoTooltip.inEditOrCreateMode) {
          _this.showTooltipsFromMousePosition(event, location, absoluteLocation);
        }
      }));

      this.eventsSubscriptions.push(_this.eventEmitter.subscribe('removeTooltips.' + _this.windowId, function() {
        jQuery(_this.osdViewer.element).qtip('destroy', true);
      }));

      this.eventsSubscriptions.push(_this.eventEmitter.subscribe('disableTooltips.' + _this.windowId, function() {
        if (_this.annoTooltip) {
          _this.annoTooltip.inEditOrCreateMode = true;
        }
      }));

      this.eventsSubscriptions.push(_this.eventEmitter.subscribe('enableTooltips.' + _this.windowId, function() {
        if (_this.annoTooltip) {
          _this.annoTooltip.inEditOrCreateMode = false;
        }
        _this.svgOverlay.restoreDraftShapes();
      }));

      this.eventsSubscriptions.push(_this.eventEmitter.subscribe('SET_ANNOTATION_EDITING.' + _this.windowId, function(event, options) {
        jQuery.each(_this.annotationsToShapesMap, function(key, paths) {
          // if we have a matching annotationId, pass the boolean value on for each path, otherwise, always pass false
          if (key === options.annotationId) {
            if (options.isEditable) {
              _this.eventEmitter.publish('SET_OVERLAY_TOOLTIP.' + _this.windowId, {"tooltip" : options.tooltip, "visible" : true, "paths" : paths});
            } else {
              _this.eventEmitter.publish('SET_OVERLAY_TOOLTIP.' + _this.windowId, {"tooltip" : null, "visible" : false, "paths" : []});
            }
            jQuery.each(paths, function(index, path) {
              //just in case, force the shape to be non hovered
              var tool = _this.svgOverlay.getTool(path);
              tool.onHover(false, path);

              path.data.editable = options.isEditable;
              if (options.isEditable) {
                path.data.currentStrokeValue = path.data.editStrokeValue;
                path.strokeWidth = path.data.currentStrokeValue / _this.svgOverlay.paperScope.view.zoom;
              } else {
                path.data.currentStrokeValue = path.data.defaultStrokeValue;
                path.strokeWidth = path.data.currentStrokeValue / _this.svgOverlay.paperScope.view.zoom;
              }
            });
          } else {
            jQuery.each(paths, function(index, path) {
              path.data.editable = false;
            });
          }
        });
        _this.svgOverlay.paperScope.view.draw();
      }));

      this.eventsSubscriptions.push(_this.eventEmitter.subscribe('refreshOverlay.' + _this.windowId, function (event) {
        _this.render();
      }));
    },

    getAnnoFromRegion: function(regionId) {
      return this.list.filter(function(annotation) {
        return annotation['@id'] === regionId;
      });
    },

    destroy: function () {
      var _this = this;
      this.eventsSubscriptions.forEach(function(event){
        _this.eventEmitter.unsubscribe(event.name,event.handler);
      });
      this.osdViewer.removeHandler('close', this._thisDestroy);
    }

  };
}(Mirador));
