function slugify(text) {
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start of text
    .replace(/-+$/, '');            // Trim - from end of text
}

(function() {
  // clipboard
  var clipInit = false;
  $("pre code").each(function() {
    var code = $(this), text = code.text();

    if (text.length > 5) {
      if (!clipInit) {
        var text,
          clip = new Clipboard(".copy-btn", {
            text: function(trigger) {
              text = $(trigger).prev("code").text();
              return text.replace(/^\$\s/gm, "");
            }
          });

        var inPre;
        clip.on("success", function(e) {
          e.clearSelection();
          inPre = $(e.trigger).parent().prop("tagName") == "PRE";
          $(e.trigger).text("Copied to clipboard!")
            .addClass('copied');

          window.setTimeout(function() {
            $(e.trigger).text("Copy").removeClass('copied');
          }, 2000);
        });

        clip.on("error", function(e) {
          e.clearSelection();
          inPre = $(e.trigger).parent().prop("tagName") == "PRE";
          $(e.trigger).text("Error copying");

          window.setTimeout(function() {
            $(e.trigger).text("Copy");
          }, 2000);
        });

        clipInit = true;
      }

      code.after('<span class="copy-btn">Copy</span>');
    }
  });

  // Sidebar
  var h2s = document.querySelectorAll("h2");
  var h3s = document.querySelectorAll("h3");
  var isAfter = function(e1, e2) {
    return e1.compareDocumentPosition(e2) & Node.DOCUMENT_POSITION_FOLLOWING;
  };
  var activeLink = document.querySelector(".doc-toc.active");

  // TODO: h2sWithH3s
  var h2sWithH3s = [];
  var j = 0;
  for (var i = 0; i < h2s.length; i++) {
    var h2 = h2s[i];
    var nextH2 = h2s[i + 1];
    var ourH3s = [];
    while (
      h3s[j] && isAfter(h2, h3s[j]) && (!nextH2 || !isAfter(nextH2, h3s[j]))
    ) {
      ourH3s.push({ header: h3s[j] });
      j++;
    }

    h2sWithH3s.push({
      header: h2,
      subHeaders: ourH3s
    });
  }

  if (h2sWithH3s.length > 0) {
    createSubtopic(activeLink, h2sWithH3s);
  }

  function createSubtopic(container, headers) {
    var subMenu = document.createElement("ul");
    subMenu.className = "sub-topic";
    container.appendChild(subMenu);

    Array.prototype.forEach.call(headers, function(h) {
      var li = createSubtopicItem(h.header);
      subMenu.appendChild(li);
    });
  }

  function createSubtopicItem(h) {
    var li = document.createElement("li");
    li.innerHTML = '<a href="#' +
      h.id +
      '" data-scroll class="' +
      h.tagName +
      '"><span>' +
      (h.title || h.textContent) +
      "</span></a>";
    return li;
  }

  // Sidebar toggle
  document.getElementById('sidebar-toggle').addEventListener('click', function (e) {
    e.preventDefault();
    var klass = document.body.className;
    if (klass === "sidebar-visible") {
      document.body.className = "";
    } else {
      document.body.className = "sidebar-visible";
    }
  });

  // Anchor tags for headings
  function appendAnchor(heading) {
    // First remove the id from heading
    // Instead we will assign the id to the .anchor-offset element to account
    // for the fixed header height
    heading.id = '';

    var text = heading.innerText;
    var slug = slugify(text);

    var anchorOffset = document.createElement('div');
    anchorOffset.className = 'anchor-offset';
    anchorOffset.id = slug;

    var anchor = document.createElement("a");
    anchor.href = '#' + slug;
    anchor.className = 'anchor';
    // anchor.innerHTML = 'link'
    anchor.innerHTML = '<i class="fa fa-link"></i>'
    heading.insertBefore(anchor, heading.firstChild);
    heading.insertBefore(anchorOffset, heading.firstChild);
  }
  var h2s = document.querySelectorAll(
    '.content-wrapper h2, .content-wrapper h3');
  for (var i = 0; i < h2s.length; i++) {
    appendAnchor(h2s[i]);
  }

  // code collapse
  var pres = document.getElementsByTagName("pre");
  Array.prototype.forEach.call(pres, function(pre) {
    if (pre.clientHeight > 330) {
      pre.className += " collapsed";

      var showMore = document.createElement("div");
      showMore.className = "showmore";
      showMore.innerHTML = "Show all";
      showMore.addEventListener("click", function() {
        pre.className = "";
        showMore.parentNode.removeChild(showMore);
      });

      pre.appendChild(showMore);
    }
  });

  // version selector
  var currentVersion = location.pathname.split("/")[1];
  document
    .getElementsByClassName("version-selector")[0]
    .addEventListener("change", function(e) {
      var targetVersion = e.target.value;

      if (currentVersion !== targetVersion) {
        // Getting everything after targetVersion and concatenating it with the hash part.
        var targetPath = "/" +
          targetVersion +
          "/" +
          location.pathname.split("/").slice(2).join("/") +
          location.hash;
        location.assign(targetPath);
      }
    });

  var versionSelector = document.getElementsByClassName("version-selector")[0],
    options = versionSelector.options;

  for (var i = 0; i < options.length; i++) {
    if (options[i].value.indexOf("latest") != -1) {
      options[i].value = options[i].value.replace(/\s\(latest\)/, "");
    }
  }

  for (var i = 0; i < options.length; i++) {
    if (options[i].value === currentVersion) {
      options[i].selected = true;
      break;
    }
  }

  // Add target = _blank to all external links.
  var links = document.links;

  for (var i = 0, linksLength = links.length; i < linksLength; i++) {
    if (links[i].hostname != window.location.hostname) {
      links[i].target = "_blank";
    }
  }
})();
