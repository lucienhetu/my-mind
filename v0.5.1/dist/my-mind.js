/* My Mind web app: all source files combined. */
if (!Function.prototype.bind) {
    Function.prototype.bind = function(thisObj) {
        var fn = this;
        var args = Array.prototype.slice.call(arguments, 1);
        return function() {
            return fn.apply(thisObj, args.concat(Array.prototype.slice.call(arguments)));
        }
    }
};

var MM = {
    _subscribers: {},

    publish: function(message, publisher, data) {
        var subscribers = this._subscribers[message] || [];
        subscribers.forEach(function(subscriber) {
            subscriber.handleMessage(message, publisher, data);
        });
    },

    subscribe: function(message, subscriber) {
        if (!(message in this._subscribers)) {
            this._subscribers[message] = [];
        }
        var index = this._subscribers[message].indexOf(subscriber);
        if (index == -1) { this._subscribers[message].push(subscriber); }
    },

    unsubscribe: function(message, subscriber) {
        var index = this._subscribers[message].indexOf(subscriber);
        if (index > -1) { this._subscribers[message].splice(index, 1); }
    },

    generateId: function() {
        var str = "";
        for (var i = 0; i < 8; i++) {
            var code = Math.floor(Math.random() * 26);
            str += String.fromCharCode("a".charCodeAt(0) + code);
        }
        return str;
    }
};
/*
	Any copyright is dedicated to the Public Domain.
	http://creativecommons.org/publicdomain/zero/1.0/
*/



 MM.Repo = {
    id: "", /* internal ID */
    label: "", /* human-readable label */
    getAll: function() {
        var all = [];
        for (var p in this) {
            var val = this[p];
            if (this.isPrototypeOf(val)) { all.push(val); }
        }
        return all;
    },
    getByProperty: function(property, value) {
        return this.getAll().filter(function(item) {
            return item[property] == value;
        })[0] || null;
    },
    getById: function(id) {
        return this.getByProperty("id", id);
    },
    buildOption: function() {
        var o = document.createElement("option");
        o.value = this.id;
        o.innerHTML = this.label;
        return o;
    }
}
MM.Item = function() {
    this._parent = null;
    this._children = [];
    this._collapsed = true;

    this._layout = null;
    this._shape = null;
    this._autoShape = true;
    this._color = null;
    this._value = null;
//    this._status = null;
    this._side = null; /* side preference */
    this._id = MM.generateId();
    this._oldText = "";
/*
    this._computed = {
        value: 0,
        status: null
    }
*/
    this._dom = {
        node: document.createElement("li"),
        content: document.createElement("div"),
//        status: document.createElement("span"),
        value: document.createElement("span"),
        text: document.createElement("div"),
        children: document.createElement("ul"),
        toggle: document.createElement("div"),
        canvas: document.createElement("canvas")
    }
    this._dom.node.classList.add("item");
    this._dom.content.classList.add("content");
//    this._dom.status.classList.add("status");
    this._dom.value.classList.add("value");
    this._dom.text.classList.add("text");
    this._dom.toggle.classList.add("toggle");
    this._dom.children.classList.add("children");

    this._dom.content.appendChild(this._dom.text); /* status+value are appended in layout */
    this._dom.node.appendChild(this._dom.canvas);
    this._dom.node.appendChild(this._dom.content);
    /* toggle+children are appended when children exist */

    this._dom.toggle.addEventListener("click", this);
}

MM.Item.COLOR = "#999";

/* RE explanation:
 *          _________________________________________________________________________ One of the three possible variants
 *           ____________________ scheme://x
 *                                ___________________________ aa.bb.cc
 *                                                            _______________________ aa.bb/
 *                                                                                    ______ path, search
 *                                                                                          __________________________ end with a non-forbidden char
 *                                                                                                                    ______ end of word or end of string
 */
MM.Item.RE = /\b(([a-z][\w-]+:\/\/\w)|(([\w-]+\.){2,}[a-z][\w-]+)|([\w-]+\.[a-z][\w-]+\/))[^\s]*([^\s,.;:?!<>\(\)\[\]'"])?($|\b)/i;

MM.Item.fromJSON = function(data) {
    return new this().fromJSON(data);
}

MM.Item.prototype.toJSON = function() {
    var data = {
        id: this._id,
        text: this.getText()
    }

    if (this._side) { data.side = this._side; }
    if (this._color) { data.color = this._color; }
    if (this._value) { data.value = this._value; }
//    if (this._status) { data.status = this._status; }
    if (this._layout) { data.layout = this._layout.id; }
    if (!this._autoShape) { data.shape = this._shape.id; }
    if (this._collapsed) { data.collapsed = 1; }
    if (this._children.length) {
        data.children = this._children.map(function(child) { return child.toJSON(); });
    }

    return data;
}

/**
 * Only when creating a new item. To merge existing items, use .mergeWith().
 */
MM.Item.prototype.fromJSON = function(data) {
    this.setText(data.text);
    if (data.id) { this._id = data.id; }
    if (data.side) { this._side = data.side; }
    if (data.color) { this._color = data.color; }
    if (data.value) { this._value = data.value; }
/*
    if (data.status) {
        this._status = data.status;
        if (this._status == "maybe") { this._status = "computed"; }
    }
*/
    if (data.collapsed) { this.collapse(); }
    if (data.layout) { this._layout = MM.Layout.getById(data.layout); }
    if (data.shape) { this.setShape(MM.Shape.getById(data.shape)); }

    (data.children || []).forEach(function(child) {
        this.insertChild(MM.Item.fromJSON(child));
    }, this);

    return this;
}

MM.Item.prototype.mergeWith = function(data) {
    var dirty = 0;

    if (this.getText() != data.text && !this._dom.text.contentEditable) { this.setText(data.text); }

    if (this._side != data.side) {
        this._side = data.side;
        dirty = 1;
    }

    if (this._color != data.color) {
        this._color = data.color;
        dirty = 2;
    }

    if (this._value != data.value) {
        this._value = data.value;
        dirty = 1;
    }
/*
    if (this._status != data.status) {
        this._status = data.status;
        dirty = 1;
    }
*/
    if (this._collapsed != !!data.collapsed) { this[this._collapsed ? "expand" : "collapse"](); }

    if (this.getOwnLayout() != data.layout) {
        this._layout = MM.Layout.getById(data.layout);
        dirty = 2;
    }

    var s = (this._autoShape ? null : this._shape.id);
    if (s != data.shape) { this.setShape(MM.Shape.getById(data.shape)); }

    (data.children || []).forEach(function(child, index) {
        if (index >= this._children.length) { /* new child */
            this.insertChild(MM.Item.fromJSON(child));
        } else { /* existing child */
            var myChild = this._children[index];
            if (myChild.getId() == child.id) { /* recursive merge */
                myChild.mergeWith(child);
            } else { /* changed; replace */
                this.removeChild(this._children[index]);
                this.insertChild(MM.Item.fromJSON(child), index);
            }
        }
    }, this);

    /* remove dead children */
    var newLength = (data.children || []).length;
    while (this._children.length > newLength) { this.removeChild(this._children[this._children.length - 1]); }

    if (dirty == 1) { this.update(); }
    if (dirty == 2) { this.updateSubtree(); }
}

MM.Item.prototype.clone = function() {
    var data = this.toJSON();

    var removeId = function(obj) {
        delete obj.id;
        obj.children && obj.children.forEach(removeId);
    }
    removeId(data);

    return this.constructor.fromJSON(data);
}

MM.Item.prototype.select = function() {
    this._dom.node.classList.add("current");
    this.getMap().ensureItemVisibility(this);
    MM.Clipboard.focus(); /* going to mode 2c */
    MM.publish("item-select", this);
}

MM.Item.prototype.deselect = function() {
    /* we were in 2b; finish that via 3b */
    if (MM.App.editing) { MM.Command.Finish.execute(); }
    this._dom.node.classList.remove("current");
}

MM.Item.prototype.update = function(doNotRecurse) {
    var map = this.getMap();
    if (!map || !map.isVisible()) { return this; }

    MM.publish("item-change", this);

    if (this._autoShape) { /* check for changed auto-shape */
        var autoShape = this._getAutoShape();
        if (autoShape != this._shape) {
            if (this._shape) { this._shape.unset(this); }
            this._shape = autoShape;
            this._shape.set(this);
        }
    }

//    this._updateStatus();
//    this._updateValue();

    this._dom.node.classList[this._collapsed ? "add" : "remove"]("collapsed");

    this.getLayout().update(this);
    this.getShape().update(this);
    if (!this.isRoot() && !doNotRecurse) { this._parent.update(); }
if (this.isRoot()) { this.expand(); }
    return this;
}

MM.Item.prototype.updateSubtree = function(isSubChild) {
    this._children.forEach(function(child) {
        child.updateSubtree(true);
    });
    return this.update(isSubChild);
}

MM.Item.prototype.setText = function(text) {
    this._dom.text.innerHTML = text;
    this._findLinks(this._dom.text);
    return this.update();
}

MM.Item.prototype.getId = function() {
    return this._id;
}

MM.Item.prototype.getText = function() {
    return this._dom.text.innerHTML;
}

MM.Item.prototype.collapse = function() {
    if (this._collapsed) { return; }
    this._collapsed = true;
    return this.update();
}

MM.Item.prototype.expand = function() {
    if (!this._collapsed) { return; }
    this._collapsed = false;
    this.update();
    return this.updateSubtree();
}

MM.Item.prototype.isCollapsed = function() {
    return this._collapsed;
}

MM.Item.prototype.setValue = function(value) {
    this._value = value;
    return this.update();
}

MM.Item.prototype.getValue = function() {
    return this._value;
}

/*
MM.Item.prototype.setStatus = function(status) {
    this._status = status;
    return this.update();
}

MM.Item.prototype.getStatus = function() {
    return this._status;
}

MM.Item.prototype.getComputedStatus = function() {
    return this._computed.status;
}
*/

MM.Item.prototype.setSide = function(side) {
    this._side = side;
    return this;
}

MM.Item.prototype.getSide = function() {
    return this._side;
}

MM.Item.prototype.getChildren = function() {
    return this._children;
}

MM.Item.prototype.setColor = function(color) {
    this._color = color;
    return this.updateSubtree();
}

MM.Item.prototype.getColor = function() {
    return this._color || (this.isRoot() ? MM.Item.COLOR : this._parent.getColor());
}

MM.Item.prototype.getOwnColor = function() {
    return this._color;
}

MM.Item.prototype.getLayout = function() {
    return this._layout || this._parent.getLayout();
}

MM.Item.prototype.getOwnLayout = function() {
    return this._layout;
}

MM.Item.prototype.setLayout = function(layout) {
    this._layout = layout;
    return this.updateSubtree();
}

MM.Item.prototype.getShape = function() {
    return this._shape;
}

MM.Item.prototype.getOwnShape = function() {
    return (this._autoShape ? null : this._shape);
}

MM.Item.prototype.setShape = function(shape) {
    if (this._shape) { this._shape.unset(this); }

    if (shape) {
        this._autoShape = false;
        this._shape = shape;
    } else {
        this._autoShape = true;
        this._shape = this._getAutoShape();
    }

    this._shape.set(this);
    return this.update();
}

MM.Item.prototype.getDOM = function() {
    return this._dom;
}

MM.Item.prototype.getMap = function() {
    var item = this._parent;
    while (item) {
        if (item instanceof MM.Map) { return item; }
        item = item.getParent();
    }
    return null;
}

MM.Item.prototype.getParent = function() {
    return this._parent;
}

MM.Item.prototype.isRoot = function() {
    return (this._parent instanceof MM.Map);
}

MM.Item.prototype.setParent = function(parent) {
    this._parent = parent;
    return this.updateSubtree();
}

MM.Item.prototype.insertChild = function(child, index) {
    /* Create or remove child as necessary. This must be done before computing the index (inserting own child) */
    var newChild = false;
    if (!child) {
        child = new MM.Item();
        newChild = true;
    } else if (child.getParent() && child.getParent().removeChild) { /* only when the child has non-map parent */
        child.getParent().removeChild(child);
    }

    if (!this._children.length) {
        this._dom.node.appendChild(this._dom.toggle);
        this._dom.node.appendChild(this._dom.children);
    }

    if (arguments.length < 2) { index = this._children.length; }

    var next = null;
    if (index < this._children.length) { next = this._children[index].getDOM().node; }
    this._dom.children.insertBefore(child.getDOM().node, next);
    this._children.splice(index, 0, child);
    return child.setParent(this);
}

MM.Item.prototype.removeChild = function(child) {
    var index = this._children.indexOf(child);
    this._children.splice(index, 1);
    var node = child.getDOM().node;
    node.parentNode.removeChild(node);

    child.setParent(null);

    if (!this._children.length) {
        this._dom.toggle.parentNode.removeChild(this._dom.toggle);
        this._dom.children.parentNode.removeChild(this._dom.children);
    }

    return this.update();
}

MM.Item.prototype.startEditing = function() {
    this._oldText = this.getText();
    this._dom.text.contentEditable = true;
    this._dom.text.focus(); /* switch to 2b */
    document.execCommand("styleWithCSS", null, false);

    this._dom.text.addEventListener("input", this);
    this._dom.text.addEventListener("keydown", this);
    this._dom.text.addEventListener("blur", this);
    return this;
}

MM.Item.prototype.stopEditing = function() {
    this._dom.text.removeEventListener("input", this);
    this._dom.text.removeEventListener("keydown", this);
    this._dom.text.removeEventListener("blur", this);

    this._dom.text.blur();
    this._dom.text.contentEditable = false;
    var result = this._dom.text.innerHTML;
    this._dom.text.innerHTML = this._oldText;
    this._oldText = "";

    this.update(); /* text changed */

    MM.Clipboard.focus();

    return result;
}

MM.Item.prototype.handleEvent = function(e) {
    switch (e.type) {
        case "input":
            this.update();
            this.getMap().ensureItemVisibility(this);
            break;

        case "keydown":
            if (e.keyCode == 9) { e.preventDefault(); } /* TAB has a special meaning in this app, do not use it to change focus */
            break;

        case "blur": /* 3d */
            MM.Command.Finish.execute();
            break;

        case "click":
            if (this._collapsed) { this.expand(); } else { this.collapse(); }
            MM.App.select(this);
            break;
    }
}

MM.Item.prototype._getAutoShape = function() {
    var depth = 0;
    var node = this;
    while (!node.isRoot()) {
        depth++;
        node = node.getParent();
    }
    switch (depth) {
        case 0: return MM.Shape.Ellipse;
        case 1: return MM.Shape.Box;
        default: return MM.Shape.Underline;
    }
}
/*
MM.Item.prototype._updateStatus = function() {
    this._dom.status.className = "status";
    this._dom.status.style.display = "";

    var status = this._status;
    if (this._status == "computed") {
        var childrenStatus = this._children.every(function(child) {
            return (child.getComputedStatus() !== false);
        });
        status = (childrenStatus ? "yes" : "no");
    }

    switch (status) {
        case "yes":
            this._dom.status.classList.add("yes");
            this._computed.status = true;
            break;

        case "no":
            this._dom.status.classList.add("no");
            this._computed.status = false;
            break;

        default:
            this._computed.status = null;
            this._dom.status.style.display = "none";
            break;
    }
}
*/
MM.Item.prototype._findLinks = function(node) {

    var children = [].slice.call(node.childNodes);
    for (var i = 0; i < children.length; i++) {
        var child = children[i];
        switch (child.nodeType) {
            case 1: /* element */
                if (child.nodeName.toLowerCase() == "a") { continue; }
                this._findLinks(child);
                break;

            case 3: /* text */
                var result = child.nodeValue.match(this.constructor.RE);
                if (result) {
                    var before = child.nodeValue.substring(0, result.index);
                    var after = child.nodeValue.substring(result.index + result[0].length);
                    var link = document.createElement("a");
                    link.innerHTML = link.href = result[0];

                    if (before) {
                        node.insertBefore(document.createTextNode(before), child);
                    }

                    node.insertBefore(link, child);

                    if (after) {
                        child.nodeValue = after;
                        i--; /* re-try with the aftertext */
                    } else {
                        node.removeChild(child);
                    }
                }
                break;
        }
    }
}
MM.Map = function(options) {
    var o = {
        root: "My Mind Map",
        layout: MM.Layout.Map
    }
    for (var p in options) { o[p] = options[p]; }
    this._root = null;
    this._visible = false;
    this._position = [0, 0];

    this._setRoot(new MM.Item().setText(o.root).setLayout(o.layout));
}

MM.Map.fromJSON = function(data) {
    return new this().fromJSON(data);
}

MM.Map.prototype.toJSON = function() {
    var data = {
        root: this._root.toJSON()
    };
    return data;
}

MM.Map.prototype.fromJSON = function(data) {
    this._setRoot(MM.Item.fromJSON(data.root));
    return this;
}

MM.Map.prototype.mergeWith = function(data) {
    /* store a sequence of nodes to be selected when merge is over */
    var ids = [];
    var current = MM.App.current;
    var node = current;
    while (node != this) {
        ids.push(node.getId());
        node = node.getParent();
    }

    this._root.mergeWith(data.root);

    if (current.getMap()) { /* selected node still in tree, cool */
        /* if one of the parents got collapsed, act as if the node got removed */
        var node = current.getParent();
        var hidden = false;
        while (node != this) {
            if (node.isCollapsed()) { hidden = true; }
            node = node.getParent();
        }
        if (!hidden) { return; } /* nothing bad happened, continue */
    }

    /* previously selected node is no longer in the tree OR it is folded */

    /* what if the node was being edited? */
    if (MM.App.editing) { current.stopEditing(); }

    /* get all items by their id */
    var idMap = {};
    var scan = function(item) {
        idMap[item.getId()] = item;
        item.getChildren().forEach(scan);
    }
    scan(this._root);

    /* select the nearest existing parent */
    while (ids.length) {
        var id = ids.shift();
        if (id in idMap) {
            MM.App.select(idMap[id]);
            return;
        }
    }
}

MM.Map.prototype.isVisible = function() {
    return this._visible;
}

MM.Map.prototype.update = function() {
    this._root.updateSubtree();
    return this;
}

MM.Map.prototype.show = function(where) {
    var node = this._root.getDOM().node;
    where.appendChild(node);
    this._visible = true;
    this._root.updateSubtree();
    this.center();
    MM.App.select(this._root);
    return this;
}

MM.Map.prototype.hide = function() {
    var node = this._root.getDOM().node;
    node.parentNode.removeChild(node);
    this._visible = false;
    return this;
}

MM.Map.prototype.center = function() {
    var node = this._root.getDOM().node;
    var port = MM.App.portSize;
    var left = (port[0] - node.offsetWidth) / 2;
    var top = (port[1] - node.offsetHeight) / 2;

    this._moveTo(Math.round(left), Math.round(top));

    return this;
}

MM.Map.prototype.moveBy = function(dx, dy) {
    return this._moveTo(this._position[0] + dx, this._position[1] + dy);
}

MM.Map.prototype.getClosestItem = function(x, y) {
    var all = [];

    var scan = function(item) {
        var rect = item.getDOM().content.getBoundingClientRect();
        var dx = rect.left + rect.width / 2 - x;
        var dy = rect.top + rect.height / 2 - y;
        all.push({
            item: item,
            dx: dx,
            dy: dy
        });
        if (!item.isCollapsed()) { item.getChildren().forEach(scan); }
    }

    scan(this._root);

    all.sort(function(a, b) {
        var da = a.dx * a.dx + a.dy * a.dy;
        var db = b.dx * b.dx + b.dy * b.dy;
        return da - db;
    });

    return all[0];
}

MM.Map.prototype.getItemFor = function(node) {
    var port = this._root.getDOM().node.parentNode;
    while (node != port && !node.classList.contains("content")) {
        node = node.parentNode;
    }
    if (node == port) { return null; }

    var scan = function(item, node) {
        if (item.getDOM().content == node) { return item; }
        var children = item.getChildren();
        for (var i = 0; i < children.length; i++) {
            var result = scan(children[i], node);
            if (result) { return result; }
        }
        return null;
    }

    return scan(this._root, node);
}

MM.Map.prototype.ensureItemVisibility = function(item) {
    var padding = 10;

    var node = item.getDOM().content;
    var itemRect = node.getBoundingClientRect();
    var root = this._root.getDOM().node;
    var parentRect = root.parentNode.getBoundingClientRect();

    var delta = [0, 0];

    var dx = parentRect.left - itemRect.left + padding;
    if (dx > 0) { delta[0] = dx; }
    var dx = parentRect.right - itemRect.right - padding;
    if (dx < 0) { delta[0] = dx; }

    var dy = parentRect.top - itemRect.top + padding;
    if (dy > 0) { delta[1] = dy; }
    var dy = parentRect.bottom - itemRect.bottom - padding;
    if (dy < 0) { delta[1] = dy; }

    if (delta[0] || delta[1]) {
        this.moveBy(delta[0], delta[1]);
    }
}

MM.Map.prototype.getParent = function() {
    return null;
}

MM.Map.prototype.getRoot = function() {
    return this._root;
}

MM.Map.prototype.getName = function() {
    var name = this._root.getText();
    return MM.Format.br2nl(name).replace(/\n/g, " ").replace(/<.*?>/g, "").trim();
}

MM.Map.prototype.getId = function() {
    return this._root.getId();
}

MM.Map.prototype.pick = function(item, direction) {
    var candidates = [];
    var currentRect = item.getDOM().content.getBoundingClientRect();

    this._getPickCandidates(currentRect, this._root, direction, candidates);
    if (!candidates.length) { return item; }

    candidates.sort(function(a, b) {
        return a.dist - b.dist;
    });

    return candidates[0].item;
}

MM.Map.prototype._getPickCandidates = function(currentRect, item, direction, candidates) {
    if (!item.isCollapsed()) {
        item.getChildren().forEach(function(child) {
            this._getPickCandidates(currentRect, child, direction, candidates);
        }, this);
    }

    var node = item.getDOM().content;
    var rect = node.getBoundingClientRect();

    if (direction == "left" || direction == "right") {
        var x1 = currentRect.left + currentRect.width / 2;
        var x2 = rect.left + rect.width / 2;
        if (direction == "left" && x2 > x1) { return; }
        if (direction == "right" && x2 < x1) { return; }

        var diff1 = currentRect.top - rect.bottom;
        var diff2 = rect.top - currentRect.bottom;
        var dist = Math.abs(x2 - x1);
    } else {
        var y1 = currentRect.top + currentRect.height / 2;
        var y2 = rect.top + rect.height / 2;
        if (direction == "top" && y2 > y1) { return; }
        if (direction == "bottom" && y2 < y1) { return; }

        var diff1 = currentRect.left - rect.right;
        var diff2 = rect.left - currentRect.right;
        var dist = Math.abs(y2 - y1);
    }

    var diff = Math.max(diff1, diff2);
    if (diff > 0) { return; }
    if (!dist || dist < diff) { return; }

    candidates.push({ item: item, dist: dist });
}

MM.Map.prototype._moveTo = function(left, top) {
    this._position = [left, top];

    var node = this._root.getDOM().node;
    node.style.left = left + "px";
    node.style.top = top + "px";
}

MM.Map.prototype._setRoot = function(item) {
    this._root = item;
    this._root.setParent(this);
}
MM.Keyboard = {};
MM.Keyboard.init = function() {
    window.addEventListener("keydown", this);
    window.addEventListener("keypress", this);
}

MM.Keyboard.handleEvent = function(e) {
    /* mode 2a: ignore keyboard when the activeElement resides somewhere inside of the UI pane */
    var node = document.activeElement;
    while (node && node != document) {
        if (node.classList.contains("ui")) { return; }
        node = node.parentNode;
    }

    var commands = MM.Command.getAll();
    for (var i = 0; i < commands.length; i++) {
        var command = commands[i];
        if (!command.isValid()) { continue; }
        var keys = command.keys;
        for (var j = 0; j < keys.length; j++) {
            if (this._keyOK(keys[j], e)) {
                command.prevent && e.preventDefault();
                command.execute(e);
                return;
            }
        }
    }
}

MM.Keyboard._keyOK = function(key, e) {
    if ("keyCode" in key && e.type != "keydown") { return false; }
    if ("charCode" in key && e.type != "keypress") { return false; }
    for (var p in key) {
        if (key[p] != e[p]) { return false; }
    }
    return true;
}
MM.Tip = {
    _node: null,

    handleEvent: function() {
        this._hide();
    },

    handleMessage: function() {
        this._hide();
    },

    init: function() {
        this._node = document.querySelector("#tip");
        this._node.addEventListener("click", this);

        MM.subscribe("command-child", this);
        MM.subscribe("command-sibling", this);
    },

    _hide: function() {
        MM.unsubscribe("command-child", this);
        MM.unsubscribe("command-sibling", this);

        this._node.removeEventListener("click", this);
        this._node.classList.add("hidden");
        this._node = null;
    }
}
MM.Action = function() {}
MM.Action.prototype.perform = function() {}
MM.Action.prototype.undo = function() {}

MM.Action.Multi = function(actions) {
    this._actions = actions;
}
MM.Action.Multi.prototype = Object.create(MM.Action.prototype);
MM.Action.Multi.prototype.perform = function() {
    this._actions.forEach(function(action) {
        action.perform();
    });
}
MM.Action.Multi.prototype.undo = function() {
    this._actions.slice().reverse().forEach(function(action) {
        action.undo();
    });
}
MM.Action.InsertNewItem = function(parent, index) {
    this._parent = parent;
    this._index = index;
    this._item = new MM.Item();
    MM.UI.Backend.storeRethinkDBFromJson("InsertNewItem", this);
}
MM.Action.InsertNewItem.prototype = Object.create(MM.Action.prototype);
MM.Action.InsertNewItem.prototype.perform = function() {
    this._parent.expand(); /* FIXME remember? */
    this._item = this._parent.insertChild(this._item, this._index);
    MM.App.select(this._item);
}
MM.Action.InsertNewItem.prototype.undo = function() {
    this._parent.removeChild(this._item);
    MM.App.select(this._parent);
}

MM.Action.AppendItem = function(parent, item) {
    this._parent = parent;
    this._item = item;
}
MM.Action.AppendItem.prototype = Object.create(MM.Action.prototype);
MM.Action.AppendItem.prototype.perform = function() {
    this._parent.insertChild(this._item);
    MM.App.select(this._item);
}
MM.Action.AppendItem.prototype.undo = function() {
    this._parent.removeChild(this._item);
    MM.App.select(this._parent);
}

MM.Action.RemoveItem = function(item) {
    this._item = item;
    this._parent = item.getParent();
    this._index = this._parent.getChildren().indexOf(this._item);
}
MM.Action.RemoveItem.prototype = Object.create(MM.Action.prototype);
MM.Action.RemoveItem.prototype.perform = function() {
    this._parent.removeChild(this._item);
    MM.App.select(this._parent);
}
MM.Action.RemoveItem.prototype.undo = function() {
    this._parent.insertChild(this._item, this._index);
    MM.App.select(this._item);
}

MM.Action.MoveItem = function(item, newParent, newIndex, newSide) {
    this._item = item;
    this._newParent = newParent;
    this._newIndex = (arguments.length < 3 ? null : newIndex);
    this._newSide = newSide || "";
    this._oldParent = item.getParent();
    this._oldIndex = this._oldParent.getChildren().indexOf(item);
    this._oldSide = item.getSide();
}
MM.Action.MoveItem.prototype = Object.create(MM.Action.prototype);
MM.Action.MoveItem.prototype.perform = function() {
    this._item.setSide(this._newSide);
    if (this._newIndex === null) {
        this._newParent.insertChild(this._item);
    } else {
        this._newParent.insertChild(this._item, this._newIndex);
    }
    MM.App.select(this._item);
    MM.UI.Backend.storeRethinkDBFromJson("MoveItem", this);
}
MM.Action.MoveItem.prototype.undo = function() {
    this._item.setSide(this._oldSide);
    this._oldParent.insertChild(this._item, this._oldIndex);
    MM.App.select(this._newParent);
}

MM.Action.Swap = function(item, diff) {
    this._item = item;
    this._parent = item.getParent();

    var children = this._parent.getChildren();
    var sibling = this._parent.getLayout().pickSibling(this._item, diff);

    this._sourceIndex = children.indexOf(this._item);
    this._targetIndex = children.indexOf(sibling);
}
MM.Action.Swap.prototype = Object.create(MM.Action.prototype);
MM.Action.Swap.prototype.perform = function() {
    this._parent.insertChild(this._item, this._targetIndex);
}
MM.Action.Swap.prototype.undo = function() {
    this._parent.insertChild(this._item, this._sourceIndex);
}

MM.Action.SetLayout = function(item, layout) {
    this._item = item;
    this._layout = layout;
    this._oldLayout = item.getOwnLayout();
}
MM.Action.SetLayout.prototype = Object.create(MM.Action.prototype);
MM.Action.SetLayout.prototype.perform = function() {
    this._item.setLayout(this._layout);
}
MM.Action.SetLayout.prototype.undo = function() {
    this._item.setLayout(this._oldLayout);
}

MM.Action.SetShape = function(item, shape) {
    this._item = item;
    this._shape = shape;
    this._oldShape = item.getOwnShape();
}
MM.Action.SetShape.prototype = Object.create(MM.Action.prototype);
MM.Action.SetShape.prototype.perform = function() {
    this._item.setShape(this._shape);
}
MM.Action.SetShape.prototype.undo = function() {
    this._item.setShape(this._oldShape);
}

MM.Action.SetColor = function(item, color) {
    this._item = item;
    this._color = color;
    this._oldColor = item.getOwnColor();
}
MM.Action.SetColor.prototype = Object.create(MM.Action.prototype);
MM.Action.SetColor.prototype.perform = function() {
    this._item.setColor(this._color);
}
MM.Action.SetColor.prototype.undo = function() {
    this._item.setColor(this._oldColor);
}

MM.Action.SetText = function(item, text) {
    this._item = item;
    this._text = text;
    this._oldText = item.getText();
    this._oldValue = item.getValue(); /* adjusting text can also modify value! */
}
MM.Action.SetText.prototype = Object.create(MM.Action.prototype);
MM.Action.SetText.prototype.perform = function() {
    this._item.setText(this._text);
    var numText = Number(this._text);
    if (numText == this._text) { this._item.setValue(numText); }
}
MM.Action.SetText.prototype.undo = function() {
    this._item.setText(this._oldText);
    this._item.setValue(this._oldValue);
}

MM.Action.SetValue = function(item, value) {
    this._item = item;
    this._value = value;
    this._oldValue = item.getValue();
}
MM.Action.SetValue.prototype = Object.create(MM.Action.prototype);
MM.Action.SetValue.prototype.perform = function() {
    this._item.setValue(this._value);
}
MM.Action.SetValue.prototype.undo = function() {
    this._item.setValue(this._oldValue);
}
/*
MM.Action.SetStatus = function(item, status) {
    this._item = item;
    this._status = status;
    this._oldStatus = item.getStatus();
}
MM.Action.SetStatus.prototype = Object.create(MM.Action.prototype);
MM.Action.SetStatus.prototype.perform = function() {
    this._item.setStatus(this._status);
}
MM.Action.SetStatus.prototype.undo = function() {
    this._item.setStatus(this._oldStatus);
}


MM.Action.SetStatus.prototype.undo = function() {
    this._item.setSide(this._oldSide);
    this._item.getMap().update();
}
*/

MM.Action.SetSide = function(item, side) {
    this._item = item;
    this._side = side;
    this._oldSide = item.getSide();
}

MM.Action.SetSide.prototype = Object.create(MM.Action.prototype);
MM.Action.SetSide.prototype.perform = function() {
    this._item.setSide(this._side);
    this._item.getMap().update();
}


MM.Action.InsertNewItemFromPeer = function(id, parent, index) {
    this._id = id;
    this._parent = parent;
    this._index = index;
    this._item = new MM.Item();
}
MM.Action.InsertNewItemFromPeer.prototype = Object.create(MM.Action.prototype);
MM.Action.InsertNewItemFromPeer.prototype.perform = function() {
    this._item = this._parent.insertChild(this._item, this._index);
    this._item._id = this._id;
}



MM.Action.MoveItemFromPeer = function(item, newParent, newIndex) {
    this._item = item;
    this._newParent = newParent;
    this._newIndex = newIndex;
    this._oldParent = item.getParent();
    this._oldIndex = this._oldParent.getChildren().indexOf(item);
}
MM.Action.MoveItemFromPeer.prototype = Object.create(MM.Action.prototype);
MM.Action.MoveItemFromPeer.prototype.perform = function() {
    if (this._newIndex === null) {
        this._newParent.insertChild(this._item);
    } else {
        this._newParent.insertChild(this._item, this._newIndex);
    }
}




MM.Action.SetTextFromPeer = function(item, text) {
    this._item = item;
    this._text = text;
    this._oldText = item.getText();
    this._oldValue = item.getValue(); /* adjusting text can also modify value! */
}
MM.Action.SetTextFromPeer.prototype = Object.create(MM.Action.prototype);
MM.Action.SetTextFromPeer.prototype.perform = function() {
    this._item.setText(this._text);
    var numText = Number(this._text);
    if (numText == this._text) { this._item.setValue(numText); }
}

MM.Clipboard = {
    _item: null,
    _mode: "",
    _delay: 50,
    _node: document.createElement("textarea")
};

MM.Clipboard.init = function() {
    this._node.style.position = "absolute";
    this._node.style.width = 0;
    this._node.style.height = 0;
    this._node.style.left = "-100px";
    this._node.style.top = "-100px";
    document.body.appendChild(this._node);
}

MM.Clipboard.focus = function() {
    this._node.focus();
    this._empty();
}

MM.Clipboard.copy = function(sourceItem) {
    this._endCut();
    this._item = sourceItem.clone();
    this._mode = "copy";

    this._expose();
}

MM.Clipboard.paste = function(targetItem) {
    setTimeout(function() {
        var pasted = this._node.value;
        this._empty();
        if (!pasted) { return; } /* nothing */

        if (this._item && pasted == MM.Format.Plaintext.to(this._item.toJSON())) { /* pasted a previously copied/cut item */
            this._pasteItem(this._item, targetItem);
        } else { /* pasted some external data */
            this._pastePlaintext(pasted, targetItem);
        }

    }.bind(this), this._delay);
}

MM.Clipboard._pasteItem = function(sourceItem, targetItem) {
    switch (this._mode) {
        case "cut":
            if (sourceItem == targetItem || sourceItem.getParent() == targetItem) { /* abort by pasting on the same node or the parent */
                this._endCut();
                return;
            }

            var item = targetItem;
            while (!item.isRoot()) {
                if (item == sourceItem) { return; } /* moving to a child => forbidden */
                item = item.getParent();
            }

            var action = new MM.Action.MoveItem(sourceItem, targetItem);
            MM.App.action(action);

            this._endCut();
            break;

        case "copy":
            var action = new MM.Action.AppendItem(targetItem, sourceItem.clone());
            MM.App.action(action);
            break;
    }
}

MM.Clipboard._pastePlaintext = function(plaintext, targetItem) {
    if (this._mode == "cut") { this._endCut(); } /* external paste => abort cutting */

    var json = MM.Format.Plaintext.from(plaintext);
    var map = MM.Map.fromJSON(json);
    var root = map.getRoot();

    if (root.getText()) {
        var action = new MM.Action.AppendItem(targetItem, root);
        MM.App.action(action);
    } else {
        var actions = root.getChildren().map(function(item) {
            return new MM.Action.AppendItem(targetItem, item);
        });
        var action = new MM.Action.Multi(actions);
        MM.App.action(action);
    }
}

MM.Clipboard.cut = function(sourceItem) {
    this._endCut();

    this._item = sourceItem;
    this._item.getDOM().node.classList.add("cut");
    this._mode = "cut";

    this._expose();
}

/**
 * Expose plaintext data to the textarea to be copied to system clipboard. Clear afterwards.
 */
MM.Clipboard._expose = function() {
    var json = this._item.toJSON();
    var plaintext = MM.Format.Plaintext.to(json);
    this._node.value = plaintext;
    this._node.selectionStart = 0;
    this._node.selectionEnd = this._node.value.length;
    setTimeout(this._empty.bind(this), this._delay);
}

MM.Clipboard._empty = function() {
    /* safari needs a non-empty selection in order to actually perfrom a real copy on cmd+c */
    this._node.value = "\n";
    this._node.selectionStart = 0;
    this._node.selectionEnd = this._node.value.length;
}

MM.Clipboard._endCut = function() {
    if (this._mode != "cut") { return; }

    this._item.getDOM().node.classList.remove("cut");
    this._item = null;
    this._mode = "";
}
MM.Menu = {
    _dom: {},
    _port: null,

    open: function(x, y) {
        this._dom.node.style.display = "";
        var w = this._dom.node.offsetWidth;
        var h = this._dom.node.offsetHeight;

        var left = x;
        var top = y;

        if (left > this._port.offsetWidth / 2) { left -= w; }
        if (top > this._port.offsetHeight / 2) { top -= h; }

        this._dom.node.style.left = left + "px";
        this._dom.node.style.top = top + "px";
    },

    close: function() {
        this._dom.node.style.display = "none";
    },

    handleEvent: function(e) {
        if (e.currentTarget != this._dom.node) {
            this.close();
            return;
        }

        e.stopPropagation(); /* no dragdrop, no blur of activeElement */
        e.preventDefault(); /* we do not want to focus the button */

        var command = e.target.getAttribute("data-command");
        if (!command) { return; }

        command = MM.Command[command];
        if (!command.isValid()) { return; }

        command.execute();
        this.close();
    },

    init: function(port) {
        this._port = port;
        this._dom.node = document.querySelector("#menu");
        var buttons = this._dom.node.querySelectorAll("[data-command]");
        [].slice.call(buttons).forEach(function(button) {
            button.innerHTML = MM.Command[button.getAttribute("data-command")].label;
        });

        this._port.addEventListener("mousedown", this);
        this._dom.node.addEventListener("mousedown", this);

        this.close();
    }
}

MM.Command = Object.create(MM.Repo, {
    keys: { value: [] },
    editMode: { value: false },
    prevent: { value: true }, /* prevent default keyboard action? */
    label: { value: "" }
});

MM.Command.isValid = function() {
    return (this.editMode === null || this.editMode == MM.App.editing);
}
MM.Command.execute = function() {}

MM.Command.Undo = Object.create(MM.Command, {
    label: { value: "Undo" },
    keys: { value: [{ keyCode: "Z".charCodeAt(0), ctrlKey: true }] }
});
MM.Command.Undo.isValid = function() {
    return MM.Command.isValid.call(this) && !!MM.App.historyIndex;
}
MM.Command.Undo.execute = function() {
    MM.App.history[MM.App.historyIndex - 1].undo();
    MM.App.historyIndex--;
}

MM.Command.Redo = Object.create(MM.Command, {
    label: { value: "Redo" },
    keys: { value: [{ keyCode: "Y".charCodeAt(0), ctrlKey: true }] },
});
MM.Command.Redo.isValid = function() {
    return (MM.Command.isValid.call(this) && MM.App.historyIndex != MM.App.history.length);
}
MM.Command.Redo.execute = function() {
    MM.App.history[MM.App.historyIndex].perform();
    MM.App.historyIndex++;
}

MM.Command.InsertSibling = Object.create(MM.Command, {
    label: { value: "Insert a sibling" },
    keys: { value: [{ keyCode: 13 }] }
});
MM.Command.InsertSibling.execute = function() {
    var item = MM.App.current;
    if (item.isRoot()) {
        var action = new MM.Action.InsertNewItem(item, item.getChildren().length);
    } else {
        var parent = item.getParent();
        var index = parent.getChildren().indexOf(item);
        var action = new MM.Action.InsertNewItem(parent, index + 1);
    }
    MM.App.action(action);

    MM.Command.Edit.execute();

    MM.publish("command-sibling");
}

MM.Command.InsertChild = Object.create(MM.Command, {
    label: { value: "Insert a child" },
    keys: {
        value: [
            { keyCode: 9, ctrlKey: false },
            { keyCode: 45 }
        ]
    }
});
MM.Command.InsertChild.execute = function() {
    var item = MM.App.current;
    var action = new MM.Action.InsertNewItem(item, item.getChildren().length);
    MM.App.action(action);

    MM.Command.Edit.execute();

    MM.publish("command-child");
}

MM.Command.Delete = Object.create(MM.Command, {
    label: { value: "Delete an item" },
    keys: { value: [{ keyCode: 46 }] }
});
MM.Command.Delete.isValid = function() {
    return MM.Command.isValid.call(this) && !MM.App.current.isRoot();
}
MM.Command.Delete.execute = function() {
    var action = new MM.Action.RemoveItem(MM.App.current);
    MM.App.action(action);
    MM.UI.Backend.storeRethinkDBFromJson("Delete", action);
}

MM.Command.Swap = Object.create(MM.Command, {
    label: { value: "Swap sibling" },
    keys: {
        value: [
            { keyCode: 38, ctrlKey: true },
            { keyCode: 40, ctrlKey: true },
        ]
    }
});
MM.Command.Swap.execute = function(e) {
    var current = MM.App.current;
    if (current.isRoot() || current.getParent().getChildren().length < 2) { return; }

    var diff = (e.keyCode == 38 ? -1 : 1);
    var action = new MM.Action.Swap(MM.App.current, diff);
    MM.App.action(action);
}

MM.Command.Side = Object.create(MM.Command, {
    label: { value: "Change side" },
    keys: {
        value: [
            { keyCode: 37, ctrlKey: true },
            { keyCode: 39, ctrlKey: true },
        ]
    }
});
MM.Command.Side.execute = function(e) {
    var current = MM.App.current;
    if (current.isRoot() || !current.getParent().isRoot()) { return; }

    var side = (e.keyCode == 37 ? "left" : "right");
    var action = new MM.Action.SetSide(MM.App.current, side);
    MM.App.action(action);
}

MM.Command.Save = Object.create(MM.Command, {
    label: { value: "Save map" },
    keys: { value: [{ keyCode: "S".charCodeAt(0), ctrlKey: true, shiftKey: false }] }
});
MM.Command.Save.execute = function() {
    MM.App.io.quickSave();
}

MM.Command.SaveAs = Object.create(MM.Command, {
    label: { value: "Save as&hellip;" },
    keys: { value: [{ keyCode: "S".charCodeAt(0), ctrlKey: true, shiftKey: true }] }
});
MM.Command.SaveAs.execute = function() {
    MM.App.io.show("save");
}

MM.Command.Load = Object.create(MM.Command, {
    label: { value: "Load map" },
    keys: { value: [{ keyCode: "O".charCodeAt(0), ctrlKey: true }] }
});
MM.Command.Load.execute = function() {
    MM.App.io.show("load");
}

MM.Command.Center = Object.create(MM.Command, {
    label: { value: "Center map" },
    keys: { value: [{ keyCode: 36 }] }
});
MM.Command.Center.execute = function() {
    MM.App.map.center();
}

MM.Command.New = Object.create(MM.Command, {
    label: { value: "New map" },
    keys: { value: [{ keyCode: "N".charCodeAt(0), ctrlKey: true }] }
});
MM.Command.New.execute = function() {
    if (!confirm("Throw away your current map and start a new one?")) { return; }
    var map = new MM.Map();
    MM.App.setMap(map);
    MM.publish("map-new", this);
}

MM.Command.ZoomIn = Object.create(MM.Command, {
    label: { value: "Zoom in" },
    keys: { value: [{ charCode: "+".charCodeAt(0) }] }
});
MM.Command.ZoomIn.execute = function() {
    MM.App.adjustFontSize(1);
}

MM.Command.ZoomOut = Object.create(MM.Command, {
    label: { value: "Zoom out" },
    keys: { value: [{ charCode: "-".charCodeAt(0) }] }
});
MM.Command.ZoomOut.execute = function() {
    MM.App.adjustFontSize(-1);
}

MM.Command.Help = Object.create(MM.Command, {
    label: { value: "Show/hide help" },
    keys: { value: [{ charCode: "?".charCodeAt(0) }] }
});
MM.Command.Help.execute = function() {
    MM.App.help.toggle();
}

MM.Command.UI = Object.create(MM.Command, {
    label: { value: "Show/hide UI" },
    keys: { value: [{ charCode: "*".charCodeAt(0) }] }
});
MM.Command.UI.execute = function() {
    MM.App.ui.toggle();
}

MM.Command.Copy = Object.create(MM.Command, {
    label: { value: "Copy" },
    prevent: { value: false },
    keys: {value: [
            { keyCode: "C".charCodeAt(0), ctrlKey: true },
            { keyCode: "C".charCodeAt(0), metaKey: true }
        ]}
});
MM.Command.Copy.execute = function() {
    MM.Clipboard.copy(MM.App.current);
}

MM.Command.Cut = Object.create(MM.Command, {
    label: { value: "Cut" },
    prevent: { value: false },
    keys: {value: [
            { keyCode: "X".charCodeAt(0), ctrlKey: true },
            { keyCode: "X".charCodeAt(0), metaKey: true }
        ]}
});
MM.Command.Cut.execute = function() {
    MM.Clipboard.cut(MM.App.current);
}

MM.Command.Paste = Object.create(MM.Command, {
    label: { value: "Paste" },
    prevent: { value: false },
    keys: {value: [
            { keyCode: "V".charCodeAt(0), ctrlKey: true },
            { keyCode: "V".charCodeAt(0), metaKey: true }
        ]}
});
MM.Command.Paste.execute = function() {
    MM.Clipboard.paste(MM.App.current);
}

MM.Command.Fold = Object.create(MM.Command, {
    label: { value: "Fold/Unfold" },
    keys: { value: [{ charCode: " ".charCodeAt(0), ctrlKey: false }] }
});
MM.Command.Fold.execute = function() {
    var item = MM.App.current;
    if (item.isCollapsed()) { 
		MM.UI.Backend.storeRethinkDBFromJson("pref_show", item);
		item.expand(); 
	} else { 
		MM.UI.Backend.storeRethinkDBFromJson("pref_hide", item);
		item.collapse(); 
	}
    MM.App.map.ensureItemVisibility(item);
}
MM.Command.Edit = Object.create(MM.Command, {
    label: { value: "Edit item" },
    keys: {value: [
            //{ keyCode: 32 },
            { keyCode: 113 }
        ]}
});
MM.Command.Edit.execute = function() {
    MM.App.current.startEditing();
    MM.App.editing = true;
}

MM.Command.Finish = Object.create(MM.Command, {
    keys: { value: [{ keyCode: 13, altKey: false, ctrlKey: false, shiftKey: false }] },
    editMode: { value: true }
});

MM.Command.Finish.execute = function() {
    MM.App.editing = false;
    var text = MM.App.current.stopEditing();
    if (text) {
        var action = new MM.Action.SetText(MM.App.current, text);
		MM.UI.Backend.storeRethinkDBFromJson("EditText", action);
    } else {
        var action = new MM.Action.RemoveItem(MM.App.current);
		 MM.UI.Backend.storeRethinkDBFromJson("Delete", action);
    }
    MM.App.action(action);
}

MM.Command.Newline = Object.create(MM.Command, {
    label: { value: "Line break" },
    keys: {value: [
            { keyCode: 13, shiftKey: true },
            { keyCode: 13, ctrlKey: true }
        ]},
    editMode: { value: true }
});
MM.Command.Newline.execute = function() {
    var range = getSelection().getRangeAt(0);
    var br = document.createElement("br");
    range.insertNode(br);
    range.setStartAfter(br);
    MM.App.current.updateSubtree();
}

MM.Command.Cancel = Object.create(MM.Command, {
    editMode: { value: true },
    keys: { value: [{ keyCode: 27 }] }
});
MM.Command.Cancel.execute = function() {
	MM.App.editing = false;
	MM.App.current.stopEditing();
	var oldText = MM.App.current.getText();
	if (!oldText) { /* newly added node */
		var action = new MM.Action.RemoveItem(MM.App.current);
		MM.App.action(action);
	}
}

MM.Command.Gotofirstnode = Object.create(MM.Command, {
    editMode: { value: false },
    keys: { value: [{ keyCode: 27 }] }
});
MM.Command.Gotofirstnode.execute = function() {
	MM.App.map.center();
}

MM.Command.CursorAtEndPosition = Object.create(MM.Command, {
    editMode: { value: false },
    keys: { value: [{ keyCode: 35 }] }
});
MM.Command.CursorAtEndPosition.execute = function() {
    MM.App.current.startEditing();
    MM.App.editing = true;
    var range = getSelection().getRangeAt(0);
    range.setStartAfter(MM.App.current.getDOM().text);
    range.collapse(false);
	range.moveEnd(MM.App.current.getDOM().text, MM.App.current.getDOM().text.length);
//BUG: add new line 
/*
	var range = getSelection().getRangeAt(0);
	range.selectNodeContents(MM.App.current.getDOM().text);
	range.collapse(false);
	var selection = getSelection();
	selection.removeAllRanges();
	selection.addRange(range);
	console.log(MM.App.current.getDOM().text);
*/
}

MM.Command.Style = Object.create(MM.Command, {
    editMode: { value: null },
    command: { value: "" }
});

MM.Command.Style.execute = function() {
    if (MM.App.editing) {
        document.execCommand(this.command, null, null);
    } else {
        MM.Command.Edit.execute();
        var selection = getSelection();
        var range = selection.getRangeAt(0);
        range.selectNodeContents(MM.App.current.getDOM().text);
        selection.removeAllRanges();
        selection.addRange(range);
        this.execute();
        MM.Command.Finish.execute();
    }
}

/*
MM.Command.Bold = Object.create(MM.Command.Style, {
    command: { value: "bold" },
    label: { value: "Bold" },
    keys: { value: [{ keyCode: "B".charCodeAt(0), ctrlKey: true }] }
});

MM.Command.Underline = Object.create(MM.Command.Style, {
    command: { value: "underline" },
    label: { value: "Underline" },
    keys: { value: [{ keyCode: "U".charCodeAt(0), ctrlKey: true }] }
});

MM.Command.Italic = Object.create(MM.Command.Style, {
    command: { value: "italic" },
    label: { value: "Italic" },
    keys: { value: [{ keyCode: "I".charCodeAt(0), ctrlKey: true }] }
});

MM.Command.Strikethrough = Object.create(MM.Command.Style, {
    command: { value: "strikeThrough" },
    label: { value: "Strike-through" },
    keys: { value: [{ keyCode: "S".charCodeAt(0), ctrlKey: true }] }
});
*/
MM.Command.Value = Object.create(MM.Command, {
    label: { value: "Set value" },
    keys: { value: [{ charCode: "v".charCodeAt(0), ctrlKey: false, metaKey: false }] }
});
MM.Command.Value.execute = function() {
    var item = MM.App.current;
    var oldValue = item.getValue();
    var newValue = prompt("Set item value", oldValue);
    if (newValue == null) { return; }

    if (!newValue.length) { newValue = null; }

    var numValue = parseFloat(newValue);
    var action = new MM.Action.SetValue(item, isNaN(numValue) ? newValue : numValue);
    MM.App.action(action);
}
MM.Command.Select = Object.create(MM.Command, {
    label: { value: "Move selection" },
    keys: {value: [
            { keyCode: 38, ctrlKey: false },
            { keyCode: 37, ctrlKey: false },
            { keyCode: 40, ctrlKey: false },
            { keyCode: 39, ctrlKey: false }
        ]}
});
MM.Command.Select.execute = function(e) {
    var dirs = {
        37: "left",
        38: "top",
        39: "right",
        40: "bottom"
    }
    var dir = dirs[e.keyCode];

    var layout = MM.App.current.getLayout();
    var item = /*MM.App.map*/ layout.pick(MM.App.current, dir);
    MM.App.select(item);
}

MM.Command.SelectRoot = Object.create(MM.Command, {
    label: { value: "Select root" },
    keys: { value: [{ keyCode: 36 }] }
});
MM.Command.SelectRoot.execute = function() {
    var item = MM.App.current;
    while (!item.isRoot()) { item = item.getParent(); }
    MM.App.select(item);
}

MM.Command.SelectParent = Object.create(MM.Command, {
    label: { value: "Select parent" },
    keys: { value: [{ keyCode: 8 }] }
});
	
MM.Command.SelectParent.execute = function() {
    if (MM.App.current.isRoot()) { return; }
    MM.App.select(MM.App.current.getParent());
}

MM.Layout = Object.create(MM.Repo, {
    ALL: { value: [] },
    SPACING_RANK: { value: 4 },
    SPACING_CHILD: { value: 4 },
});

MM.Layout.getAll = function() {
    return this.ALL;
}

/**
 * Re-draw an item and its children
 */
MM.Layout.update = function(item) {
    return this;
}

/**
 * @param {MM.Item} child Child node (its parent uses this layout)
 */
MM.Layout.getChildDirection = function(child) {
    return "";
}

MM.Layout.pick = function(item, dir) {
    var opposite = {
        left: "right",
        right: "left",
        top: "bottom",
        bottom: "top"
    }

    /* direction for a child */
    if (!item.isCollapsed()) {
        var children = item.getChildren();
        for (var i = 0; i < children.length; i++) {
            var child = children[i];
            if (this.getChildDirection(child) == dir) { return child; }
        }
    }

    if (item.isRoot()) { return item; }

    var parentLayout = item.getParent().getLayout();
    var thisChildDirection = parentLayout.getChildDirection(item);
    if (thisChildDirection == dir) {
        return item;
    } else if (thisChildDirection == opposite[dir]) {
        return item.getParent();
    } else {
        return parentLayout.pickSibling(item, (dir == "left" || dir == "top" ? -1 : +1));
    }
}

MM.Layout.pickSibling = function(item, dir) {
    if (item.isRoot()) { return item; }

    var children = item.getParent().getChildren();
    var index = children.indexOf(item);
    index += dir;
    index = (index + children.length) % children.length;
    return children[index];
}

/**
 * Adjust canvas size and position
 */
MM.Layout._anchorCanvas = function(item) {
    var dom = item.getDOM();
    dom.canvas.width = dom.node.offsetWidth;
    dom.canvas.height = dom.node.offsetHeight;
}

MM.Layout._anchorToggle = function(item, x, y, side) {
    var node = item.getDOM().toggle;
    var w = node.offsetWidth;
    var h = node.offsetHeight;
    var l = x;
    var t = y;

    switch (side) {
        case "left":
            t -= h / 2;
            l -= w;
            break;

        case "right":
            t -= h / 2;
            break;

        case "top":
            l -= w / 2;
            t -= h;
            break;

        case "bottom":
            l -= w / 2;
            break;
    }

    node.style.left = Math.round(l) + "px";
    node.style.top = Math.round(t) + "px";
}

MM.Layout._getChildAnchor = function(item, side) {
    var dom = item.getDOM();
    if (side == "left" || side == "right") {
        var pos = dom.node.offsetLeft + dom.content.offsetLeft;
        if (side == "left") { pos += dom.content.offsetWidth; }
    } else {
        var pos = dom.node.offsetTop + dom.content.offsetTop;
        if (side == "top") { pos += dom.content.offsetHeight; }
    }
    return pos;
}

MM.Layout._computeChildrenBBox = function(children, childIndex) {
    var bbox = [0, 0];
    var rankIndex = (childIndex + 1) % 2;

    children.forEach(function(child, index) {
        var node = child.getDOM().node;
        var childSize = [node.offsetWidth, node.offsetHeight];

        bbox[rankIndex] = Math.max(bbox[rankIndex], childSize[rankIndex]); /* adjust cardinal size */
        bbox[childIndex] += childSize[childIndex]; /* adjust orthogonal size */
    }, this);

    if (children.length > 1) { bbox[childIndex] += this.SPACING_CHILD * (children.length - 1); } /* child separation */

    return bbox;
}

MM.Layout._alignItem = function(item, side) {
    var dom = item.getDOM();

    switch (side) {
        case "left":
            dom.content.appendChild(dom.value);
            //dom.content.appendChild(dom.status);
            break;
        case "right":
            //dom.content.insertBefore(dom.status, dom.content.firstChild);
            dom.content.insertBefore(dom.value, dom.content.firstChild);
            break;
    }
}
MM.Layout.Graph = Object.create(MM.Layout, {
    SPACING_RANK: { value: 16 },
    childDirection: { value: "" }
});

MM.Layout.Graph.getChildDirection = function(child) {
    return this.childDirection;
}

MM.Layout.Graph.create = function(direction, id, label) {
    var layout = Object.create(this, {
        childDirection: { value: direction },
        id: { value: id },
        label: { value: label }
    });
    MM.Layout.ALL.push(layout);
    return layout;
}

MM.Layout.Graph.update = function(item) {
    var side = this.childDirection;
    if (!item.isRoot()) {
        side = item.getParent().getLayout().getChildDirection(item);
    }
    this._alignItem(item, side);

    this._layoutItem(item, this.childDirection);

    if (this.childDirection == "left" || this.childDirection == "right") {
        this._drawLinesHorizontal(item, this.childDirection);
    } else {
        this._drawLinesVertical(item, this.childDirection);
    }

    return this;
}


/**
 * Generic graph child layout routine. Updates item's orthogonal size according to the sum of its children.
 */
MM.Layout.Graph._layoutItem = function(item, rankDirection) {
    var sizeProps = ["width", "height"];
    var posProps = ["left", "top"];
    var rankIndex = (rankDirection == "left" || rankDirection == "right" ? 0 : 1);
    var childIndex = (rankIndex + 1) % 2;

    var rankPosProp = posProps[rankIndex];
    var childPosProp = posProps[childIndex];
    var rankSizeProp = sizeProps[rankIndex];
    var childSizeProp = sizeProps[childIndex];

    var dom = item.getDOM();

    /* content size */
    var contentSize = [dom.content.offsetWidth, dom.content.offsetHeight];

    /* children size */
    var bbox = this._computeChildrenBBox(item.getChildren(), childIndex);

    /* node size */
    var rankSize = contentSize[rankIndex];
    if (bbox[rankIndex]) { rankSize += bbox[rankIndex] + this.SPACING_RANK; }
    var childSize = Math.max(bbox[childIndex], contentSize[childIndex]);
//  dom.node.style[rankSizeProp] = rankSize + "px";
    dom.node.style[childSizeProp] = childSize + "px";

    var offset = [0, 0];
    if (rankDirection == "right") { offset[0] = contentSize[0] + this.SPACING_RANK; }
    if (rankDirection == "bottom") { offset[1] = contentSize[1] + this.SPACING_RANK; }
    offset[childIndex] = Math.round((childSize - bbox[childIndex]) / 2);
    this._layoutChildren(item.getChildren(), rankDirection, offset, bbox);

    /* label position */
    var labelPos = 0;
    if (rankDirection == "left") { labelPos = rankSize - contentSize[0]; }
    if (rankDirection == "top") { labelPos = rankSize - contentSize[1]; }
    dom.content.style[childPosProp] = Math.round((childSize - contentSize[childIndex]) / 2) + "px";
    dom.content.style[rankPosProp] = labelPos + "px";

    return this;
}

MM.Layout.Graph._layoutChildren = function(children, rankDirection, offset, bbox) {
    var posProps = ["left", "top"];

    var rankIndex = (rankDirection == "left" || rankDirection == "right" ? 0 : 1);
    var childIndex = (rankIndex + 1) % 2;
    var rankPosProp = posProps[rankIndex];
    var childPosProp = posProps[childIndex];

    children.forEach(function(child, index) {
        var node = child.getDOM().node;
        var childSize = [node.offsetWidth, node.offsetHeight];

        if (rankDirection == "left") { offset[0] = bbox[0] - childSize[0]; }
        if (rankDirection == "top") { offset[1] = bbox[1] - childSize[1]; }

        node.style[childPosProp] = offset[childIndex] + "px";
        node.style[rankPosProp] = offset[rankIndex] + "px";

        offset[childIndex] += childSize[childIndex] + this.SPACING_CHILD; /* offset for next child */
    }, this);

    return bbox;
}

MM.Layout.Graph._drawLinesHorizontal = function(item, side) {
    this._anchorCanvas(item);
    this._drawHorizontalConnectors(item, side, item.getChildren());
}

MM.Layout.Graph._drawLinesVertical = function(item, side) {
    this._anchorCanvas(item);
    this._drawVerticalConnectors(item, side, item.getChildren());
}

MM.Layout.Graph._drawHorizontalConnectors = function(item, side, children) {
    if (children.length == 0) { return; }

    var dom = item.getDOM();
    var canvas = dom.canvas;
    var ctx = canvas.getContext("2d");
    ctx.strokeStyle = item.getColor();
    var R = this.SPACING_RANK / 2;

    /* first part */
    var y1 = item.getShape().getVerticalAnchor(item);
    if (side == "left") {
        var x1 = dom.content.offsetLeft - 0.5;
    } else {
        var x1 = dom.content.offsetWidth + dom.content.offsetLeft + 0.5;
    }

    this._anchorToggle(item, x1, y1, side);
    if (item.isCollapsed()) { return; }

    if (children.length == 1) {
        var child = children[0];
        var y2 = child.getShape().getVerticalAnchor(child) + child.getDOM().node.offsetTop - 1;
        var x2 = this._getChildAnchor(child, side);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.bezierCurveTo((x1 + x2) / 2, y1, (x1 + x2) / 2, y2, x2, y2);
        ctx.stroke();
        return;
    }

    if (side == "left") {
        var x2 = x1 - R;
    } else {
        var x2 = x1 + R;
    }

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y1);
    ctx.stroke();

    /* rounded connectors */
    var c1 = children[0];
    var c2 = children[children.length - 1];
    var x = x2;
    var xx = x + (side == "left" ? -R : R);

    var y1 = c1.getShape().getVerticalAnchor(c1) + c1.getDOM().node.offsetTop;
    var y2 = c2.getShape().getVerticalAnchor(c2) + c2.getDOM().node.offsetTop;
    var x1 = this._getChildAnchor(c1, side);
    var x2 = this._getChildAnchor(c2, side);

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(xx, y1)
    ctx.arcTo(x, y1, x, y1 + R, R);
    ctx.lineTo(x, y2 - R);
    ctx.arcTo(x, y2, xx, y2, R);
    ctx.lineTo(x2, y2);

    for (var i = 1; i < children.length - 1; i++) {
        var c = children[i];
        var y = c.getShape().getVerticalAnchor(c) + c.getDOM().node.offsetTop;
        ctx.moveTo(x, y);
        ctx.lineTo(this._getChildAnchor(c, side), y);
    }
    ctx.stroke();
}

MM.Layout.Graph._drawVerticalConnectors = function(item, side, children) {
    if (children.length == 0) { return; }

    var dom = item.getDOM();
    var canvas = dom.canvas;
    var ctx = canvas.getContext("2d");
    ctx.strokeStyle = item.getColor();

    /* first part */
    var R = this.SPACING_RANK / 2;

    var x = item.getShape().getHorizontalAnchor(item);
    var height = (children.length == 1 ? 2 * R : R);

    if (side == "top") {
        var y1 = canvas.height - dom.content.offsetHeight;
        var y2 = y1 - height;
        this._anchorToggle(item, x, y1, side);
    } else {
        var y1 = item.getShape().getVerticalAnchor(item);
        var y2 = dom.content.offsetHeight + height;
        this._anchorToggle(item, x, dom.content.offsetHeight, side);
    }

    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2);
    ctx.stroke();


    if (children.length == 1) { return; }

    /* rounded connectors */
    var c1 = children[0];
    var c2 = children[children.length - 1];
    var offset = dom.content.offsetHeight + height;
    var y = Math.round(side == "top" ? canvas.height - offset : offset) + 0.5;

    var x1 = c1.getShape().getHorizontalAnchor(c1) + c1.getDOM().node.offsetLeft;
    var x2 = c2.getShape().getHorizontalAnchor(c2) + c2.getDOM().node.offsetLeft;
    var y1 = this._getChildAnchor(c1, side);
    var y2 = this._getChildAnchor(c2, side);

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.arcTo(x1, y, x1 + R, y, R);
    ctx.lineTo(x2 - R, y);
    ctx.arcTo(x2, y, x2, y2, R);

    for (var i = 1; i < children.length - 1; i++) {
        var c = children[i];
        var x = c.getShape().getHorizontalAnchor(c) + c.getDOM().node.offsetLeft;
        ctx.moveTo(x, y);
        ctx.lineTo(x, this._getChildAnchor(c, side));
    }
    ctx.stroke();
}


MM.Layout.Graph.Down = MM.Layout.Graph.create("bottom", "graph-bottom", "Bottom");
MM.Layout.Graph.Up = MM.Layout.Graph.create("top", "graph-top", "Top");
MM.Layout.Graph.Left = MM.Layout.Graph.create("left", "graph-left", "Left");
MM.Layout.Graph.Right = MM.Layout.Graph.create("right", "graph-right", "Right");
MM.Layout.Tree = Object.create(MM.Layout, {
    SPACING_RANK: { value: 32 },
    childDirection: { value: "" }
});

MM.Layout.Tree.getChildDirection = function(child) {
    return this.childDirection;
}

MM.Layout.Tree.create = function(direction, id, label) {
    var layout = Object.create(this, {
        childDirection: { value: direction },
        id: { value: id },
        label: { value: label }
    });
    MM.Layout.ALL.push(layout);
    return layout;
}

MM.Layout.Tree.update = function(item) {
    var side = this.childDirection;
    if (!item.isRoot()) {
        side = item.getParent().getLayout().getChildDirection(item);
    }
    this._alignItem(item, side);

    this._layoutItem(item, this.childDirection);
    this._anchorCanvas(item);
    this._drawLines(item, this.childDirection);
    return this;
}

/**
 * Generic graph child layout routine. Updates item's orthogonal size according to the sum of its children.
 */
MM.Layout.Tree._layoutItem = function(item, rankDirection) {
    var dom = item.getDOM();

    /* content size */
    var contentSize = [dom.content.offsetWidth, dom.content.offsetHeight];

    /* children size */
    var bbox = this._computeChildrenBBox(item.getChildren(), 1);

    /* node size */
    var rankSize = contentSize[0];
    var childSize = bbox[1] + contentSize[1];
    if (bbox[0]) {
        rankSize = Math.max(rankSize, bbox[0] + this.SPACING_RANK);
        childSize += this.SPACING_CHILD;
    }
    dom.node.style.width = rankSize + "px";
    dom.node.style.height = childSize + "px";

    var offset = [this.SPACING_RANK, contentSize[1] + this.SPACING_CHILD];
    if (rankDirection == "left") { offset[0] = rankSize - bbox[0] - this.SPACING_RANK; }
    this._layoutChildren(item.getChildren(), rankDirection, offset, bbox);

    /* label position */
    var labelPos = 0;
    if (rankDirection == "left") { labelPos = rankSize - contentSize[0]; }
    dom.content.style.left = labelPos + "px";
    dom.content.style.top = 0;

    return this;
}

MM.Layout.Tree._layoutChildren = function(children, rankDirection, offset, bbox) {
    children.forEach(function(child, index) {
        var node = child.getDOM().node;
        var childSize = [node.offsetWidth, node.offsetHeight];
        var left = offset[0];
        if (rankDirection == "left") { left += (bbox[0] - childSize[0]); }

        node.style.left = left + "px";
        node.style.top = offset[1] + "px";

        offset[1] += childSize[1] + this.SPACING_CHILD; /* offset for next child */
    }, this);

    return bbox;
}

MM.Layout.Tree._drawLines = function(item, side) {
    var dom = item.getDOM();
    var canvas = dom.canvas;

    var R = this.SPACING_RANK / 4;
    var x = (side == "left" ? canvas.width - 2 * R : 2 * R) + 0.5;
    this._anchorToggle(item, x, dom.content.offsetHeight, "bottom");

    var children = item.getChildren();
    if (children.length == 0 || item.isCollapsed()) { return; }

    var ctx = canvas.getContext("2d");
    ctx.strokeStyle = item.getColor();

    var y1 = item.getShape().getVerticalAnchor(item);
    var last = children[children.length - 1];
    var y2 = last.getShape().getVerticalAnchor(last) + last.getDOM().node.offsetTop;

    ctx.beginPath();
    ctx.moveTo(x, y1);
    ctx.lineTo(x, y2 - R);

    // rounded connectors
    for (var i = 0; i < children.length; i++) {
        var c = children[i];
        var y = c.getShape().getVerticalAnchor(c) + c.getDOM().node.offsetTop;
        var anchor = this._getChildAnchor(c, side);

        ctx.moveTo(x, y - R);
        ctx.arcTo(x, y, anchor, y, R);
        ctx.lineTo(anchor, y);
    }
    ctx.stroke();
}

MM.Layout.Tree.Left = MM.Layout.Tree.create("left", "tree-left", "Left");
MM.Layout.Tree.Right = MM.Layout.Tree.create("right", "tree-right", "Right");
MM.Layout.Map = Object.create(MM.Layout.Graph, {
    id: { value: "map" },
    label: { value: "Map" },
    LINE_THICKNESS: { value: 8 }
});
MM.Layout.ALL.push(MM.Layout.Map);

MM.Layout.Map.update = function(item) {
    if (item.isRoot()) {
        this._layoutRoot(item);
    } else {
        var side = this.getChildDirection(item);
        var name = side.charAt(0).toUpperCase() + side.substring(1);
        MM.Layout.Graph[name].update(item);
    }
}

/**
 * @param {MM.Item} child Child node
 */
MM.Layout.Map.getChildDirection = function(child) {
    while (!child.getParent().isRoot()) {
        child = child.getParent();
    }
    // child is now the sub-root node 

    var side = child.getSide();
    if (side) { return side; }

    var counts = { left: 0, right: 0 };
    var children = child.getParent().getChildren();
    for (var i = 0; i < children.length; i++) {
        var side = children[i].getSide();
        if (!side) {
            //side = (counts.right > counts.left ? "left" : "right");
			side = "right";	  
            children[i].setSide(side);
        }
        counts[side]++;
    }

    return child.getSide();
}

MM.Layout.Map.pickSibling = function(item, dir) {
    if (item.isRoot()) { return item; }

    var parent = item.getParent();
    var children = parent.getChildren();
    if (parent.isRoot()) {
        var side = this.getChildDirection(item);
        children = children.filter(function(child) {
            return (this.getChildDirection(child) == side);
        }, this);
    }

    var index = children.indexOf(item);
    index += dir;
    index = (index + children.length) % children.length;
    return children[index];
}

MM.Layout.Map._layoutRoot = function(item) {
    this._alignItem(item, "right");

    var dom = item.getDOM();

    var children = item.getChildren();
    var childrenLeft = [];
    var childrenRight = [];

    children.forEach(function(child, index) {
        var node = child.getDOM().node;
        var side = this.getChildDirection(child);

        if (side == "left") {
            childrenLeft.push(child);
        } else {
            childrenRight.push(child);
        }
    }, this);

    var bboxLeft = this._computeChildrenBBox(childrenLeft, 1);
    var bboxRight = this._computeChildrenBBox(childrenRight, 1);
    var height = Math.max(bboxLeft[1], bboxRight[1], dom.content.offsetHeight);

    var left = 0;
    this._layoutChildren(childrenLeft, "left", [left, Math.round((height - bboxLeft[1]) / 2)], bboxLeft);
    left += bboxLeft[0];

    if (childrenLeft.length) { left += this.SPACING_RANK; }
    dom.content.style.left = left + "px";
    left += dom.content.offsetWidth;

    if (childrenRight.length) { left += this.SPACING_RANK; }
    this._layoutChildren(childrenRight, "right", [left, Math.round((height - bboxRight[1]) / 2)], bboxRight);
    left += bboxRight[0];

    dom.content.style.top = Math.round((height - dom.content.offsetHeight) / 2) + "px";
    dom.node.style.height = height + "px";
    dom.node.style.width = left + "px";

    this._anchorCanvas(item);
    this._drawRootConnectors(item, "left", childrenLeft);
    this._drawRootConnectors(item, "right", childrenRight);
}

MM.Layout.Map._drawRootConnectors = function(item, side, children) {
    if (children.length == 0 || item.isCollapsed()) { return; }

    var dom = item.getDOM();
    var canvas = dom.canvas;
    var ctx = canvas.getContext("2d");
    var R = this.SPACING_RANK / 2;

    var x1 = dom.content.offsetLeft + dom.content.offsetWidth / 2;
    var y1 = item.getShape().getVerticalAnchor(item);
    var half = this.LINE_THICKNESS / 2;

    for (var i = 0; i < children.length; i++) {
        var child = children[i];

        var x2 = this._getChildAnchor(child, side);
        var y2 = child.getShape().getVerticalAnchor(child) + child.getDOM().node.offsetTop;
        var angle = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2;
        var dx = Math.cos(angle) * half;
        var dy = Math.sin(angle) * half;

        ctx.fillStyle = ctx.strokeStyle = child.getColor();
        ctx.beginPath();
        ctx.moveTo(x1 - dx, y1 - dy);
        ctx.quadraticCurveTo((x2 + x1) / 2, y2, x2, y2);
        ctx.quadraticCurveTo((x2 + x1) / 2, y2, x1 + dx, y1 + dy);
        ctx.fill();
        ctx.stroke();
    }

}
MM.Shape = Object.create(MM.Repo, {
    VERTICAL_OFFSET: { value: 0.5 },
});

MM.Shape.set = function(item) {
    item.getDOM().node.classList.add("shape-" + this.id);
    return this;
}

MM.Shape.unset = function(item) {
    item.getDOM().node.classList.remove("shape-" + this.id);
    return this;
}

MM.Shape.update = function(item) {
    item.getDOM().content.style.borderColor = item.getColor();
    return this;
}

MM.Shape.getHorizontalAnchor = function(item) {
    var node = item.getDOM().content;
    return Math.round(node.offsetLeft + node.offsetWidth / 2) + 0.5;
}

MM.Shape.getVerticalAnchor = function(item) {
    var node = item.getDOM().content;
    return node.offsetTop + Math.round(node.offsetHeight * this.VERTICAL_OFFSET) + 0.5;
}
MM.Shape.Underline = Object.create(MM.Shape, {
    id: { value: "underline" },
    label: { value: "Underline" },
    VERTICAL_OFFSET: { value: -3 }
});

MM.Shape.Underline.update = function(item) {
    var dom = item.getDOM();

    var ctx = dom.canvas.getContext("2d");
    ctx.strokeStyle = item.getColor();

    var left = dom.content.offsetLeft;
    var right = left + dom.content.offsetWidth;

    var top = this.getVerticalAnchor(item);

    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(right, top);
    ctx.stroke();
}

MM.Shape.Underline.getVerticalAnchor = function(item) {
    var node = item.getDOM().content;
    return node.offsetTop + node.offsetHeight + this.VERTICAL_OFFSET + 0.5;
}
MM.Shape.Box = Object.create(MM.Shape, {
    id: { value: "box" },
    label: { value: "Box" }
});
MM.Shape.Ellipse = Object.create(MM.Shape, {
    id: { value: "ellipse" },
    label: { value: "Ellipse" }
});


MM.Format = Object.create(MM.Repo, {
    extension: { value: "" },
    mime: { value: "" }
});

MM.Format.br2nl = function(str) {
    return str.replace(/<br\s*\/?>/g, "\n");
}

MM.Format.JSON = Object.create(MM.Format, {
    id: { value: "json" },
    label: { value: "Native (JSON)" },
    extension: { value: "mymind" },
    mime: { value: "application/vnd.mymind+json" }
});

MM.Format.JSON.to = function(data) {
    return JSON.stringify(data, null, "\t") + "\n";
}

MM.Format.JSON.from = function(data) {
    return JSON.parse(data);
}

MM.Backend = Object.create(MM.Repo);

/**
 * Backends are allowed to have some internal state. 
 * This method notifies them that "their" map is no longer used 
 * (was either replaced by a new one or saved using other backend).
 */
MM.Backend.reset = function() {}

MM.Backend.save = function(data, name) {}

MM.Backend.load = function(name) {}

/*
MM.Backend.File = Object.create(MM.Backend, {
    id: { value: "file" },
    label: { value: "File" },
    input: { value: document.createElement("input") }
});

MM.Backend.File.save = function(data, name) {
    var link = document.createElement("a");
    link.download = name;
    link.href = "data:text/plain;base64," + btoa(unescape(encodeURIComponent(data)));
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link);
}

MM.Backend.File.load = function() {
//TODO: delete function
}
*/

MM.UI = function() {
    this._node = document.querySelector(".ui");

    this._toggle = this._node.querySelector("#toggle");

    this._layout = new MM.UI.Layout();
    this._shape = new MM.UI.Shape();
    this._color = new MM.UI.Color();
    this._value = new MM.UI.Value();
//    this._status = new MM.UI.Status();

    MM.subscribe("item-select", this);
    MM.subscribe("item-change", this);

    this._node.addEventListener("click", this);
    this._node.addEventListener("change", this);

    this.toggle();
}

MM.UI.prototype.handleMessage = function(message, publisher) {
    switch (message) {
        case "item-select":
            this._update();
            break;

        case "item-change":
            if (publisher == MM.App.current) { this._update(); }
            break;
    }
}

MM.UI.prototype.handleEvent = function(e) {
    switch (e.type) {
        case "click":
            if (e.target.nodeName.toLowerCase() != "select") { MM.Clipboard.focus(); } // focus the clipboard (2c) 

            if (e.target == this._toggle) {
                this.toggle();
                return;
            }

            var node = e.target;
            while (node != document) {
                var command = node.getAttribute("data-command");
                if (command) {
                    MM.Command[command].execute();
                    return;
                }
                node = node.parentNode;
            }
            break;

        case "change":
            MM.Clipboard.focus(); // focus the clipboard (2c) 
            break;
    }
}

MM.UI.prototype.toggle = function() {
//WE HIDE IT TEMPORARLY 
//	this._node.classList.toggle("visible");
//    MM.publish("ui-change", this);
}


MM.UI.prototype.getWidth = function() {
    return (this._node.classList.contains("visible") ? this._node.offsetWidth : 0);
}

MM.UI.prototype._update = function() {
    this._layout.update();
    this._shape.update();
    this._value.update();
//    this._status.update();
}
MM.UI.Layout = function() {
    this._select = document.querySelector("#layout");

    this._select.appendChild(MM.Layout.Map.buildOption());

    var label = this._buildGroup("Graph");
    label.appendChild(MM.Layout.Graph.Right.buildOption());
    label.appendChild(MM.Layout.Graph.Left.buildOption());
    label.appendChild(MM.Layout.Graph.Down.buildOption());
    label.appendChild(MM.Layout.Graph.Up.buildOption());

    var label = this._buildGroup("Tree");
    label.appendChild(MM.Layout.Tree.Right.buildOption());
    label.appendChild(MM.Layout.Tree.Left.buildOption());

    this._select.addEventListener("change", this);
}

MM.UI.Layout.prototype.update = function() {
    var value = "";
    var layout = MM.App.current.getOwnLayout();
    if (layout) { value = layout.id; }
    this._select.value = value;

    this._getOption("").disabled = MM.App.current.isRoot();
    this._getOption(MM.Layout.Map.id).disabled = !MM.App.current.isRoot();
}

MM.UI.Layout.prototype.handleEvent = function(e) {
    var layout = MM.Layout.getById(this._select.value);

    var action = new MM.Action.SetLayout(MM.App.current, layout);
    MM.App.action(action);
}

MM.UI.Layout.prototype._getOption = function(value) {
    return this._select.querySelector("option[value='" + value + "']");
}

MM.UI.Layout.prototype._buildGroup = function(label) {
    var node = document.createElement("optgroup");
    node.label = label;
    this._select.appendChild(node);
    return node;
}
MM.UI.Shape = function() {
    this._select = document.querySelector("#shape");

    this._select.appendChild(MM.Shape.Box.buildOption());
    this._select.appendChild(MM.Shape.Ellipse.buildOption());
    this._select.appendChild(MM.Shape.Underline.buildOption());

    this._select.addEventListener("change", this);
}

MM.UI.Shape.prototype.update = function() {
    var value = "";
    var shape = MM.App.current.getOwnShape();
    if (shape) { value = shape.id; }

    this._select.value = value;
}

MM.UI.Shape.prototype.handleEvent = function(e) {
    var shape = MM.Shape.getById(this._select.value);

    var action = new MM.Action.SetShape(MM.App.current, shape);
    MM.App.action(action);
}
MM.UI.Value = function() {
    this._select = document.querySelector("#value");
    this._select.addEventListener("change", this);
}

MM.UI.Value.prototype.update = function() {
    var value = MM.App.current.getValue();
    if (value === null) { value = ""; }
    this._select.value = value;
}

MM.UI.Value.prototype.handleEvent = function(e) {
    var value = this._select.value;
    if (value == "num") {
        MM.Command.Value.execute();
    } else {
        var action = new MM.Action.SetValue(MM.App.current, value || null);
        MM.App.action(action);
    }
}
/*
MM.UI.Status = function() {
    this._select = document.querySelector("#status");
    this._select.addEventListener("change", this);
}

MM.UI.Status.prototype.update = function() {
    this._select.value = MM.App.current.getStatus() || "";
}

MM.UI.Status.prototype.handleEvent = function(e) {
    var action = new MM.Action.SetStatus(MM.App.current, this._select.value || null);
    MM.App.action(action);
}
*/
MM.UI.Color = function() {
    this._node = document.querySelector("#color");
    this._node.addEventListener("click", this);

    var items = this._node.querySelectorAll("[data-color]");

    for (var i = 0; i < items.length; i++) {
        var item = items[i];
        item.style.backgroundColor = item.getAttribute("data-color");
    }
}

MM.UI.Color.prototype.handleEvent = function(e) {
    e.preventDefault();
    if (!e.target.hasAttribute("data-color")) { return; }

    var color = e.target.getAttribute("data-color") || null;
    var action = new MM.Action.SetColor(MM.App.current, color);
    MM.App.action(action);
}
MM.UI.Help = function() {
    this._node = document.querySelector("#help");
    this._map = {
        8: "Backspace",
        9: "Tab",
        13: "↩",
        32: "Spacebar",
        33: "PgUp",
        34: "PgDown",
        35: "End",
        36: "Home",
        37: "←",
        38: "↑",
        39: "→",
        40: "↓",
        45: "Insert",
        46: "Delete",
        65: "A",
        68: "D",
        83: "S",
        87: "W",
        112: "F1",
        113: "F2",
        114: "F3",
        115: "F4",
        116: "F5",
        117: "F6",
        118: "F7",
        119: "F8",
        120: "F9",
        121: "F10",
        "-": "&minus;"
    };

    this._build();
}

MM.UI.Help.prototype.toggle = function() {
    this._node.classList.toggle("visible");
}

MM.UI.Help.prototype._build = function() {
    var t = this._node.querySelector(".navigation");
    this._buildRow(t, "Select");
    this._buildRow(t, "SelectRoot");
    this._buildRow(t, "SelectParent");
    this._buildRow(t, "Center");
    this._buildRow(t, "ZoomIn", "ZoomOut");
    this._buildRow(t, "Fold");

    var t = this._node.querySelector(".manipulation");
    this._buildRow(t, "InsertSibling");
    this._buildRow(t, "InsertChild");
    this._buildRow(t, "Swap");
    this._buildRow(t, "Side");
    this._buildRow(t, "Delete");

    this._buildRow(t, "Copy");
    this._buildRow(t, "Cut");
    this._buildRow(t, "Paste");

    var t = this._node.querySelector(".editing");
    this._buildRow(t, "Value");
    this._buildRow(t, "Edit");
    this._buildRow(t, "Newline");
	this._buildRow(t, "CursorAtEndPosition");
	this._buildRow(t, "Gotofirstnode");
    //this._buildRow(t, "Bold");
    //this._buildRow(t, "Italic");
    //this._buildRow(t, "Underline");
    //this._buildRow(t, "Strikethrough");

    var t = this._node.querySelector(".other");
    this._buildRow(t, "Undo", "Redo");
    this._buildRow(t, "Save");
    this._buildRow(t, "SaveAs");
    this._buildRow(t, "Load");
    this._buildRow(t, "Help");
    this._buildRow(t, "UI");
}

MM.UI.Help.prototype._buildRow = function(table, commandName) {
    var row = table.insertRow(-1);

    var labels = [];
    var keys = [];

    for (var i = 1; i < arguments.length; i++) {
        var command = MM.Command[arguments[i]];
        labels.push(command.label);
        keys = keys.concat(command.keys.map(this._formatKey, this));
    }

    row.insertCell(-1).innerHTML = labels.join("/");
    row.insertCell(-1).innerHTML = keys.join("/");

}

MM.UI.Help.prototype._formatKey = function(key) {
    var str = "";
    if (key.ctrlKey) { str += "Ctrl+"; }
    if (key.altKey) { str += "Alt+"; }
    if (key.shiftKey) { str += "Shift+"; }
    if (key.charCode) {
        var ch = String.fromCharCode(key.charCode);
        str += this._map[ch] || ch.toUpperCase();
    }
    if (key.keyCode) { str += this._map[key.keyCode] || String.fromCharCode(key.keyCode); }
    return str;
}
MM.UI.IO = function() {
    this._prefix = "mm.app.";
    this._mode = "";
    //this._node = document.querySelector("#io");
    //this._heading = this._node.querySelector("h3");

    //this._backend = this._node.querySelector("#backend");
    //this._currentBackend = null;
    //this._backends = {};
	//var ids = ["file", "horizon"];
	//var ids = ["file"];
    //ids.forEach(function(id) {
     //   var ui = MM.UI.Backend.getById(id);
    //    ui.init(this._backend);
    //    this._backends[id] = ui;
    //}, this);

    //this._backend.value = localStorage.getItem(this._prefix + "backend") || MM.Backend.File.id;
    //this._backend.addEventListener("change", this);

    //MM.subscribe("map-new", this);
    //MM.subscribe("save-done", this);
    //MM.subscribe("load-done", this);
}

//http://oskarhane.com/create-a-nested-array-recursively-in-javascr
function buildHierarchy(arry) {    
	var roots = [], children = {};    // find the top level nodes and hash the children based on parent    
	for (var i = 0, len = arry.length; i < len; ++i) {        
		var item = arry[i],            
		p = item.pid,            
		target = !p ? roots : (children[p] || (children[p] = []));        
		target.push(item);    
	}    // function to recursively build the tree    
	var findChildren = function(parent) {        
		if (children[parent.id]) {            
			parent.children = children[parent.id];            
			for (var i = 0, len = parent.children.length; i < len; ++i) { 
				findChildren(parent.children[i]);            
			}        
		}    
	};    // enumerate through to handle the case where there are multiple roots    
	for (var i = 0, len = roots.length; i < len; ++i) {        
		findChildren(roots[i]);    
	}    
	return roots;
}

MM.UI.IO.prototype.restore = function() {
	//INITIAL LOADING
	//TODO: insérer une animation loadin ici
    var parts = {};
    location.search.substring(1).split("&").forEach(function(item) {
        var keyvalue = item.split("=");
        parts[decodeURIComponent(keyvalue[0])] = decodeURIComponent(keyvalue[1]);
    });
	
    if ("id" in parts) { 
		parts.mapname = parts.id;
		//const hz = new Horizon();
		const hz = Horizon({ authType: 'token' })
		const hzdata = hz(parts.mapname);
		let root;
		hzdata.order("order").fetch().subscribe((items) => {
		//hzdata.fetch().subscribe((items) => {
			var options = {
				childKey  : 'id',
				parentKey : 'pid',
				nodeText  : 'text',
				nodeOrder : 'order'
			};
			var tree = buildHierarchy(items);
			var stree = JSON.stringify(tree, null, 2);
			stree = "{\"root\":{\n\"layout\": \"graph-right\",\n\"shape\": \"ellipse\","+stree.substr(1).slice(4, -1)+"}";
			try {
				var json = MM.Format.JSON.from(stree);
			} catch (e) {
				this._error(e);
			}
			MM.UI.Backend._loadDone.call(this, json);
			
			//open nodes from last session
			const hzUserPref = hz("userPref");
			hzUserPref.find(MM.App.user).fetch().subscribe(
				(result) => { 
					openNodes = result; 	
					var root = MM.App.map._root;
					
					for (var i = 0; i < openNodes.OpenNodes.length; i++) {
						var targetNode = findNode(openNodes.OpenNodes[i], root);
						if (targetNode !== false) {targetNode.expand();}
					}
					//TODO: put focus on last selected node
					//requiert d'enregistrer le last select
					//var targetNode = findNode(openNodes.LastNode[i], root);
					//MM.App.map.ensureItemVisibility(item);
				}
			)
		});
		
		/* ### Hook to changefeed */
//TODO?: filter out changes by self (hzdata.filter({usr: bob}).watch...
		hzdata.watch({rawChanges: true}).subscribe((item) => {	
			if (item.type == 'add'){
				//PEER ADDED A NODE 
				var root = MM.App.map._root;
				var hasNodeToAdd = findNode(item.new_val.id, root);
				if (hasNodeToAdd == true) {
					var parentNode = findNode(item.new_val.pid, root);
					var action = new MM.Action.InsertNewItemFromPeer(item.new_val.id, parentNode, item.new_val.order + 1);
					MM.App.action(action);
				}else{
				//We are the one behind that change. There is no need to update the UI
				}
			}
			if (item.type == 'remove'){
				//PEER DELETED A NODE 
				var root = MM.App.map._root;
				//navigate through all the nodes and their children		
				var nodeToDelete = findNode(item.old_val.id, root);
				if (nodeToDelete !== false) {
					//Someone deleted a node. Let's reflect this change in the UI
					var action = new MM.Action.RemoveItem(nodeToDelete);
					MM.App.action(action);
				}else{
				//We are the one behind that change. There is no need to update the UI
				}
			}
			if (item.type == 'change'){
				
				//PEER MODIFIED TEXT 
				if (item.old_val.text != item.new_val.text){
					var root = MM.App.map._root;
					var NodeToChange = findNode(item.new_val.id, root);
					if (NodeToChange._dom.text.innerHTML != item.new_val.text){
						var action = new MM.Action.SetTextFromPeer(NodeToChange, item.new_val.text);
						MM.App.action(action);
					}else{
					//We are the one behind that change. There is no need to update the UI
					}
				}
				
				//PEER MODIFIED PARENT
				if (item.old_val.pid != item.new_val.pid){
					var root = MM.App.map._root;
					var NodeToChange = findNode(item.new_val.id, root);
					
					if (item.new_val.pid !== NodeToChange._parent._id){
						var parentNode = findNode(item.new_val.pid, root);
						var action = new MM.Action.MoveItemFromPeer(NodeToChange, parentNode, item.new_val.order - 1);
						MM.App.action(action);
					}else{
					//We are the one behind that change. There is no need to update the UI
					}
				}
				
				//PEER MODIFIED ORDER
				if (item.old_val.order != item.new_val.order){
					var root = MM.App.map._root;
					var NodeToChange = findNode(item.new_val.id, root);
					if (item.new_val.id !== NodeToChange._parent._children[item.new_val.order - 1]._id){
						var action = new MM.Action.MoveItemFromPeer(NodeToChange, NodeToChange.getParent(), item.new_val.order - 1);
						MM.App.action(action);				
					}else{
					//We are the one behind that change. There is no need to update the UI
					}						
				}
			}
		});

/*	
		const hzhist = hz(parts.mapname + 'History');
//On a tenté de filtré à la source mais ça ne semb;le pas possible
//On utilisera plutôt une logique front-end
		//hzhist.watch().subscribe((item) => {			
		//hzhist.find(
		//  function (doc) {
		//	return r.expr(["menInCrust"])
		//	.contains(doc("userId"))
		//	.not();
		//  }
		//).watch.subscribe((item) => {

		//chat.find({author: "@dalanmiller"}).watch()
//TODO: try to filter out the feed of our own changes
		hzhist.watch({rawChanges: true}).subscribe((item) => {
			//console.log(item.new_val.userId);
			//console.log(item.new_val.actionType);
			//if (item.new_val.userId != "youngAsFuck") {//actualUser)...
				if (item.type == 'add'){
//						console.log(item);
//						console.log(item.new_val);
				}
			//}
		});
*/
		//backend.setState(parts);
		return;
	}
}

function findNode(id, currentNode) {
    var i,
	currentChild,
	result;

    if (id == currentNode._id) { 
		return currentNode;    
	} else {
		for (i = 0; i < currentNode._children.length; i += 1) {
			currentChild = currentNode._children[i];

			// Search in the current child 
			result = findNode(id, currentChild);
			// Return the result if the node has been found 
			if (result !== false) {
				return result;
			}        
		}        
		// The node has not been found and we have no more options        
		return false;    
	}
}

MM.UI.IO.prototype.handleMessage = function(message, publisher) {
    switch (message) {
        case "map-new":
            this._setCurrentBackend(null);
            break;

        case "save-done":
        case "load-done":
            this.hide();
            this._setCurrentBackend(publisher);
            break;
    }
}

MM.UI.IO.prototype.show = function(mode) {
    this._mode = mode;
    this._node.classList.add("visible");
    this._heading.innerHTML = mode;

    this._syncBackend();
    window.addEventListener("keydown", this);
}

MM.UI.IO.prototype.hide = function() {
    if (!this._node.classList.contains("visible")) { return; }
    this._node.classList.remove("visible");
    MM.Clipboard.focus();
    window.removeEventListener("keydown", this);
}

MM.UI.IO.prototype.quickSave = function() {
    if (this._currentBackend) {
        this._currentBackend.save();
    } else {
        this.show("save");
    }
}

MM.UI.IO.prototype.handleEvent = function(e) {
    switch (e.type) {
        case "keydown":
            if (e.keyCode == 27) { this.hide(); }
            break;

        case "change":
            this._syncBackend();
            break;
    }
}

MM.UI.IO.prototype._syncBackend = function() {
    var all = this._node.querySelectorAll("div[id]");
    [].slice.apply(all).forEach(function(node) { node.style.display = "none"; });

    this._node.querySelector("#" + this._backend.value).style.display = "";

    this._backends[this._backend.value].show(this._mode);
}

/**
 * @param {MM.UI.Backend} backend
 */
MM.UI.IO.prototype._setCurrentBackend = function(backend) {
    if (this._currentBackend && this._currentBackend != backend) { this._currentBackend.reset(); }

    if (backend) { localStorage.setItem(this._prefix + "backend", backend.id); }
    this._currentBackend = backend;
    try {
        this._updateURL(); /* fails when on file:/// */
    } catch (e) {}
}

MM.UI.IO.prototype._updateURL = function() {
    var data = this._currentBackend && this._currentBackend.getState();
    if (!data) {
        history.replaceState(null, "", ".");
    } else {
        var arr = Object.keys(data).map(function(key) {
            return encodeURIComponent(key) + "=" + encodeURIComponent(data[key]);
        });
        history.replaceState(null, "", "?" + arr.join("&"));
    }
}
MM.UI.Backend = Object.create(MM.Repo);

MM.UI.Backend.init = function(select) {
    this._backend = MM.Backend.getById(this.id);
    this._mode = "";
    this._prefix = "mm.app." + this.id + ".";

    this._node = document.querySelector("#" + this.id);

    select.appendChild(this._backend.buildOption());
}

MM.UI.Backend.reset = function() {
    this._backend.reset();
}

MM.UI.Backend.setState = function(data) {}

MM.UI.Backend.getState = function() {
    return null;
}

MM.UI.Backend.handleEvent = function(e) {
    switch (e.target) {
        case this._cancel:
            MM.App.io.hide();
            break;

        case this._go:
            this._action();
            break;
    }
}

MM.UI.Backend.save = function() {}

MM.UI.Backend.load = function() {}

MM.UI.Backend.show = function(mode) {
    this._mode = mode;

    this._go.innerHTML = mode.charAt(0).toUpperCase() + mode.substring(1);

    var all = this._node.querySelectorAll("[data-for]");
    [].concat.apply([], all).forEach(function(node) { node.style.display = "none"; });

    var visible = this._node.querySelectorAll("[data-for~=" + mode + "]");
    [].concat.apply([], visible).forEach(function(node) { node.style.display = ""; });

    /* switch to 2a: steal focus from the current item */
    this._go.focus();
}

MM.UI.Backend._action = function() {
    switch (this._mode) {
        case "save":
            this.save();
            break;

        case "load":
            this.load();
            break;
    }
}

MM.UI.Backend._saveDone = function() {
    MM.App.setThrobber(false);
    MM.publish("save-done", this);
}

MM.UI.Backend._loadDone = function(json) {
    MM.App.setThrobber(false);
    try {
        MM.App.setMap(MM.Map.fromJSON(json));
        MM.publish("load-done", this);
    } catch (e) {
        this._error(e);
    }
}

MM.UI.Backend._error = function(e) {
    MM.App.setThrobber(false);
    alert("IO error: " + e.message);
}

MM.UI.Backend._buildList = function(list, select) {
    var data = [];

    for (var id in list) {
        data.push({ id: id, name: list[id] });
    }

    data.sort(function(a, b) {
        return a.name.localeCompare(b.name);
    });

    data.forEach(function(item) {
        var o = document.createElement("option");
        o.value = item.id;
        o.innerHTML = item.name;
        select.appendChild(o);
    });
}

MM.UI.Backend.storeRethinkDBFromJson = function(flag, tmp) {
    var historyMessage;
	//const hz = new Horizon();
	//const hz = horizon;
	const hz = Horizon({ authType: 'token' })
    const hzNodes = hz("nodes");
	const hzNodeHistory = hz("nodesHistory");
	const hzUserPref = hz("userPref");
	
    switch (flag) {
        case "InsertNewItem":
            historyMessage = "UI: New node created";
			hzNodes.store({ "id": tmp._item._id, "text": "", "pid": tmp._parent._id, "order": tmp._index + 1 });
			hzNodeHistory.store({ userId: MM.App.user, "actionType": 1, "nid": tmp._item._id, "order": tmp._index + 1, "DateTime": new Date() });
			//TODO: add it to the list of nodes to open on next session
            break;
        case "EditText":
            historyMessage = "UI: Node modified";
			if (tmp._oldText != tmp._text) {
				hzNodes.update({ "id": tmp._item._id, "text": tmp._text });
				hzNodeHistory.store({ userId: MM.App.user, "actionType": 2, "nid": tmp._item._id, "oldValue": tmp._oldText, "newValue": tmp._text,  "DateTime": new Date() });
            }
			break;
        case "MoveItem":
            historyMessage = "UI: Node is moved";
			const oldIndex = tmp._oldIndex;
			var newIndex = tmp._newIndex; 
			//in certain cases, it's null. God knows why
			if (newIndex == null) {
				var children = tmp._newParent.getChildren();
				for (var i = 0; i < children.length; i++) {
					if (children[i].getId() == tmp._item._id) {
						newIndex = i;
					}
			    }
			}
			if (tmp._oldParent._id != tmp._newParent._id) {
				//update old parent nodes
				var children = tmp._oldParent.getChildren();
				for (var i = oldIndex; i < children.length; i++) {
					children[i]._id + "  order:" + (i + 1);
					hzNodes.update({ "id": children[i]._id, "order": i + 1 });
					hzNodeHistory.store({ userId: MM.App.user, "actionType": 30, "nid": children[i]._id, "newValue": i + 1, "DateTime": new Date() });
			    }
				//update new parent nodes
				var children = tmp._newParent.getChildren();				
				for (var i = newIndex; i < children.length; i++) {
					if (children[i]._id == tmp._item._id) {
						hzNodes.update({ "id": children[i]._id, "pid": tmp._newParent._id, "order": i + 1 });
						hzNodeHistory.store({ userId: MM.App.user, "actionType": 3, "nid": children[i]._id, "oldValue": oldIndex, "newValue": i + 1, "DateTime": new Date() });
					} else {
						hzNodes.update({ "id": children[i]._id, "order": i + 1 })
						hzNodeHistory.store({ userId: MM.App.user, "actionType": 30, "nid": children[i]._id, "newValue": i + 1, "DateTime": new Date() });
					}
				}
			} else {
				var children = tmp._item._parent.getChildren();
				for (var i = Math.min(oldIndex, newIndex); i < children.length; i++) {
					if (children[i]._id == tmp._item._id) {
						hzNodes.update({ "id": children[i]._id, "pid": tmp._newParent._id, "order": i + 1 });
						hzNodeHistory.store({ userId: MM.App.user, "actionType": 3, "nid": children[i]._id, "oldValue": oldIndex, "newValue": i + 1, "DateTime": new Date() });
					} else {
						hzNodes.update({ "id": children[i]._id, "order": i + 1 });
						hzNodeHistory.store({ userId: MM.App.user, "actionType": 30, "nid": children[i]._id, "newValue": i + 1, "DateTime": new Date() });
					}
				}
			}			
            break;			
        case "Delete":
            historyMessage = "UI: Node deleted";
			hzNodes.remove({id: tmp._item._id})
			hzNodeHistory.store({ userId: MM.App.user, "actionType": 4, "nid": tmp._item._id, "DateTime": new Date() });
			//DELETE CHILD
			("Delete", tmp._item, hzNodes, hzNodeHistory);
			//UPDATE ORDER
			var children = tmp._parent.getChildren();				
			for (var i = tmp._index; i < children.length; i++) {
				hzNodes.update({ "id": children[i]._id, "order": i + 1 });
				hzNodeHistory.store({ userId: MM.App.user, "actionType": 41, "nid": children[i]._id, "newValue": i + 1, "DateTime": new Date() });
			}
//TODO: Delete preferences as well for all users
            break;
		case "pref_hide":
			//Keep track of folding state > FOLDED
			hzUserPref.find(MM.App.user).fetch().subscribe(
				(result) => { 
					openNodes = result; 	
					openNodes.OpenNodes = openNodes.OpenNodes.filter(item => item !== tmp._id);
					hzUserPref.upsert(openNodes);
				}
			)
			//hzUserPref.upsert({ userId: MM.App.user, "id": tmp._id, "hide": 0});
            break;
		case "pref_show":
			//Keep track of folding state > UNFOLDED
			hzUserPref.find(MM.App.user).fetch().subscribe(
				(result) => { 
					openNodes = result; 
					
					if (openNodes === null) {
						var openNodes = [];
						var emptyArr = [];
						emptyArr = tmp._id;
						openNodes = [{'id' : MM.App.user, 'OpenNodes' : [tmp._id]}];
					} else {
						openNodes.OpenNodes.push(tmp._id);
					}
					hzUserPref.upsert(openNodes);
				}
			)
			//hzUserPref.upsert({ Id: MM.App.user, "id": tmp._id, "hide": 1});
            break;
        default:
            break;
    }
}

function allDescendants(flag, node, nodesTbl, nodesHistoryTbl) {
    for (var i = 0; i < node._children.length; i++) {
		var child = node._children[i];
		allDescendants(flag, child, nodesTbl, nodesHistoryTbl);
		switch (flag) {
			case "Delete":
			console.log("DELETE: " + child._dom.text.innerHTML);
			nodesTbl.remove({id: child._id})
			nodesHistoryTbl.store({ userId: "deal(ete)CollatBreaaaker", "actionType": 40, "nid": child._id, "DateTime": new Date() });
			break;
		}
    }
}

MM.Mouse = {
    TOUCH_DELAY: 500,
    _port: null,
    _cursor: [0, 0],
    _pos: [0, 0], // ghost pos
    _mode: "",
    _item: null,
    _ghost: null,
    _oldDragState: null,
    _touchTimeout: null
}

MM.Mouse.init = function(port) {
    this._port = port;
    this._port.addEventListener("touchstart", this);
    this._port.addEventListener("mousedown", this);
    this._port.addEventListener("click", this);
    this._port.addEventListener("dblclick", this);
    this._port.addEventListener("wheel", this);
    this._port.addEventListener("mousewheel", this);
    this._port.addEventListener("contextmenu", this);
	this._port.addEventListener("mouseover", this);
}

MM.Mouse.handleEvent = function(e) {
    switch (e.type) {
		case "mouseover":			
            var item = MM.App.map.getItemFor(e.target);
            if (this._mode == "drag" || MM.App.editing || item == MM.App.current) { return; } /* ignore on edited node */
            if (item) { MM.App.select(item); }
            break;

        case "click":
            var item = MM.App.map.getItemFor(e.target);
            if (MM.App.editing && item == MM.App.current) { return; } /* ignore on edited node */
            if (item) { MM.App.select(item); }
            break;

        case "dblclick":
            var item = MM.App.map.getItemFor(e.target);
            if (item) { MM.Command.Edit.execute(); }
            break;			

        case "contextmenu":
            this._endDrag();
            e.preventDefault();
            var item = MM.App.map.getItemFor(e.target);
            item && MM.App.select(item);
            MM.Menu.open(e.clientX, e.clientY);
            break;

        case "touchstart":
            if (e.touches.length > 1) { return; }
            e.clientX = e.touches[0].clientX;
            e.clientY = e.touches[0].clientY;

        case "mousedown":
            var item = MM.App.map.getItemFor(e.target);
            if (MM.App.editing) {
                if (item == MM.App.current) { return; } /* ignore dnd on edited node */
                MM.Command.Finish.execute(); /* clicked elsewhere => finalize edit */
            }
            if (e.type == "mousedown") { e.preventDefault(); } /* to prevent blurring the clipboard node */

            if (e.type == "touchstart") { /* context menu here, after we have the item */
                this._touchTimeout = setTimeout(function() {
                    item && MM.App.select(item);
                    MM.Menu.open(e.clientX, e.clientY);
                }, this.TOUCH_DELAY);
            }
            this._startDrag(e, item);
            break;

        case "touchmove":
            if (e.touches.length > 1) { return; }
            e.clientX = e.touches[0].clientX;
            e.clientY = e.touches[0].clientY;
            clearTimeout(this._touchTimeout);

        case "mousemove":
            this._processDrag(e);
            break;

        case "touchend":
            clearTimeout(this._touchTimeout);

        case "mouseup":
            this._endDrag();
            break;

        case "wheel":
        case "mousewheel":
            var dir = 0;
            if (e.wheelDelta) {
                if (e.wheelDelta < 0) {
                    dir = -1;
                } else if (e.wheelDelta > 0) {
                    dir = 1;
                }
            }
            if (e.deltaY) {
                if (e.deltaY > 0) {
                    dir = -1;
                } else if (e.deltaY < 0) {
                    dir = 1;
                }
            }
            if (dir) {
                MM.App.adjustFontSize(dir);
            }
            break;
    }
}

MM.Mouse._startDrag = function(e, item) {

    if (e.type == "mousedown") {
        e.preventDefault(); /* no selections allowed. only for mouse; preventing touchstart would prevent Safari from emulating clicks */
        this._port.addEventListener("mousemove", this);
        this._port.addEventListener("mouseup", this);
    } else {
        this._port.addEventListener("touchmove", this);
        this._port.addEventListener("touchend", this);
    }

    this._cursor[0] = e.clientX;
    this._cursor[1] = e.clientY;

    if (item && !item.isRoot()) {
        this._mode = "drag";
        this._item = item;
    } else {
        this._mode = "pan";
        this._port.style.cursor = "move";
    }
}

MM.Mouse._processDrag = function(e) {
    e.preventDefault();
    var dx = e.clientX - this._cursor[0];
    var dy = e.clientY - this._cursor[1];
    this._cursor[0] = e.clientX;
    this._cursor[1] = e.clientY;

    switch (this._mode) {
        case "drag":
            if (!this._ghost) {
                this._port.style.cursor = "move";
                this._buildGhost(dx, dy);
            }
            this._moveGhost(dx, dy);
            var state = this._computeDragState();
            this._visualizeDragState(state);
            break;

        case "pan":
            MM.App.map.moveBy(dx, dy);
            break;
    }
}

MM.Mouse._endDrag = function() {
    this._port.style.cursor = "";
    this._port.removeEventListener("mousemove", this);
    this._port.removeEventListener("mouseup", this);

    if (this._mode == "pan") { return; } /* no cleanup after panning */
	
    if (this._ghost) {
        var state = this._computeDragState();
        this._finishDragDrop(state);

        this._ghost.parentNode.removeChild(this._ghost);
        this._ghost = null;
    }

    this._item = null;
}

MM.Mouse._buildGhost = function() {
    var content = this._item.getDOM().content;
    this._ghost = content.cloneNode(true);
    this._ghost.classList.add("ghost");
    this._pos[0] = content.offsetLeft;
    this._pos[1] = content.offsetTop;
    content.parentNode.appendChild(this._ghost);
}

MM.Mouse._moveGhost = function(dx, dy) {
    this._pos[0] += dx;
    this._pos[1] += dy;
    this._ghost.style.left = this._pos[0] + "px";
    this._ghost.style.top = this._pos[1] + "px";

    var state = this._computeDragState();
}

MM.Mouse._finishDragDrop = function(state) {
    this._visualizeDragState(null);

    var target = state.item;
    switch (state.result) {
        case "append":
            var action = new MM.Action.MoveItem(this._item, target);
            break;

        case "sibling":
            var index = target.getParent().getChildren().indexOf(target);
            var targetIndex = index + (state.direction == "right" || state.direction == "bottom" ? 1 : 0);
            var action = new MM.Action.MoveItem(this._item, target.getParent(), targetIndex, target.getSide());
            break;

        default:
            return;
            break;
    }

    MM.App.action(action);
}

/**
 * Compute a state object for a drag: current result (""/"append"/"sibling"), parent/sibling, direction
 */
MM.Mouse._computeDragState = function() {
    var rect = this._ghost.getBoundingClientRect();
    var closest = MM.App.map.getClosestItem(rect.left + rect.width / 2, rect.top + rect.height / 2);
    var target = closest.item;

    var state = {
        result: "",
        item: target,
        direction: ""
    }

    var tmp = target;
    while (!tmp.isRoot()) {
        if (tmp == this._item) { return state; } /* drop on a child or self */
        tmp = tmp.getParent();
    }

    var w1 = this._item.getDOM().content.offsetWidth;
    var w2 = target.getDOM().content.offsetWidth;
    var w = Math.max(w1, w2);
    var h1 = this._item.getDOM().content.offsetHeight;
    var h2 = target.getDOM().content.offsetHeight;
    var h = Math.max(h1, h2);

    if (target.isRoot()) { /* append here */
        state.result = "append";
    } else if (Math.abs(closest.dx) < w && Math.abs(closest.dy) < h) { /* append here */
        state.result = "append";
    } else {
        state.result = "sibling";
        var childDirection = target.getParent().getLayout().getChildDirection(target);
        var diff = -1 * (childDirection == "top" || childDirection == "bottom" ? closest.dx : closest.dy);

        if (childDirection == "left" || childDirection == "right") {
            state.direction = (closest.dy < 0 ? "bottom" : "top");
        } else {
            state.direction = (closest.dx < 0 ? "right" : "left");
        }
    }

    return state;
}

MM.Mouse._visualizeDragState = function(state) {
    if (this._oldState && state && this._oldState.item == state.item && this._oldState.result == state.result) { return; } /* nothing changed */

    if (this._oldDragState) { /* remove old vis */
        var item = this._oldDragState.item;
        var node = item.getDOM().content;
        node.style.boxShadow = "";
    }

    this._oldDragState = state;

    if (state) { /* show new vis */
        var item = state.item;
        var node = item.getDOM().content;

        var x = 0;
        var y = 0;
        var offset = 5;
        if (state.result == "sibling") {
            if (state.direction == "left") { x = -1; }
            if (state.direction == "right") { x = +1; }
            if (state.direction == "top") { y = -1; }
            if (state.direction == "bottom") { y = +1; }
        }
        var spread = (x || y ? -2 : 2);
        node.style.boxShadow = (x * offset) + "px " + (y * offset) + "px 4px " + spread + "px #CCC";
    }
}

MM.App = {
    keyboard: null,
    current: null,
    editing: false,
	user: null,
    history: [],
    historyIndex: 0,
    portSize: [0, 0],
    map: null,
    ui: null,
    io: null,
    help: null,
    _port: null,
    _throbber: null,
    _drag: {
        pos: [0, 0],
        item: null,
        ghost: null
    },
    _fontSize: 100,

    action: function(action) {
        if (this.historyIndex < this.history.length) { /* remove undoed actions */
            this.history.splice(this.historyIndex, this.history.length - this.historyIndex);
        }

        this.history.push(action);
        this.historyIndex++;

        action.perform();
        return this;
    },

    setMap: function(map) {
        if (this.map) { this.map.hide(); }

        this.history = [];
        this.historyIndex = 0;

        this.map = map;
        this.map.show(this._port);
    },

    select: function(item) {
        if (this.current && this.current != item) { this.current.deselect(); }
        this.current = item;
        this.current.select();
    },

    adjustFontSize: function(diff) {
        this._fontSize = Math.max(30, this._fontSize + 10 * diff);
        this._port.style.fontSize = this._fontSize + "%";
        this.map.update();
        this.map.ensureItemVisibility(this.current);
    },

    handleMessage: function(message, publisher) {
        switch (message) {
            case "ui-change":
                this._syncPort();
                break;

            case "item-change":
                if (publisher.isRoot() && publisher.getMap() == this.map) {
                    document.title = this.map.getName() + " :: My Mind";
                }
                break;
        }
    },

    handleEvent: function(e) {
        switch (e.type) {
            case "resize":
                this._syncPort();
                break;

            case "beforeunload":
                e.preventDefault();
                return "";
                break;
        }
    },

    setThrobber: function(visible) {
        this._throbber.classList[visible ? "add" : "remove"]("visible");
    },

    init: function() {
        this._port = document.querySelector("#port");
        this._throbber = document.querySelector("#throbber");
        this.ui = new MM.UI();
        this.io = new MM.UI.IO();
        this.help = new MM.UI.Help();
        MM.Tip.init();
        MM.Keyboard.init();
        MM.Menu.init(this._port);
        MM.Mouse.init(this._port);
        MM.Clipboard.init();

        window.addEventListener("resize", this);
        window.addEventListener("beforeunload", this);
        MM.subscribe("ui-change", this);
        MM.subscribe("item-change", this);

        this._syncPort();
        this.setMap(new MM.Map());
    },

    _syncPort: function() {
        this.portSize = [window.innerWidth - this.ui.getWidth(), window.innerHeight];
        this._port.style.width = this.portSize[0] + "px";
        this._port.style.height = this.portSize[1] + "px";
        this._throbber.style.right = (20 + this.ui.getWidth()) + "px";
        if (this.map) { this.map.ensureItemVisibility(this.current); }
    }
}