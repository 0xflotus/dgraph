// debounce limits the amount of function invocation by spacing out the calls
// by at least `wait` ms.
function debounce(func, wait, immediate) {
  var timeout;

  return function() {
    var context = this, args = arguments;
    var later = function() {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };

    var callNow = immediate && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(context, args);
  };
};

function slugify(text) {
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start of text
    .replace(/-+$/, '');            // Trim - from end of text
}

// isElementInViewport checks if element is visible in the DOM
function isElementInViewport(el) {
  var rect = el.getBoundingClientRect();
  var topbarOffset = 64;

  return (
    rect.top >= topbarOffset &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

(function() {
  // clipboard
  var clipInit = false;
  $("pre code:not(.no-copy)").each(function() {
    var code = $(this), text = code.text();

    if (text.length > 5) {
      if (!clipInit) {
        var text;
        var clip = new Clipboard(".copy-btn", {
          text: function(trigger) {
            text = $(trigger).prev("code").text();
            return text.replace(/^\$\s/gm, "");
          }
        });

        clip.on("success", function(e) {
          e.clearSelection();
          $(e.trigger).text("Copied to clipboard!")
            .addClass('copied');

          window.setTimeout(function() {
            $(e.trigger).text("Copy").removeClass('copied');
          }, 2000);
        });

        clip.on("error", function(e) {
          e.clearSelection();
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
  var activeLink = document.querySelector(".topic.active");
  var allLinks = [];

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

  // console.log(h2sWithH3s);

  function createSubtopic(container, headers) {
    var subMenu = document.createElement("ul");
    subMenu.className = "sub-topics";
    container.appendChild(subMenu);

    Array.prototype.forEach.call(headers, function(h) {
      var li = createSubtopicItem(h.header);
      li.className = 'topic sub-topic';
      subMenu.appendChild(li);

      if (h.subHeaders) {
        createSubtopic(subMenu, h.subHeaders)
      }
    });
  }

  function createSubtopicItem(h) {
  allLinks.push(h);

    var li = document.createElement("li");
    li.innerHTML = '<i class="fa fa-angle-right"></i> <a href="#' +
      h.id +
      '" data-scroll class="' +
      h.tagName +
      '">' +
      (h.title || h.textContent) +
      "</a>";
    return li;
  }

  // setActiveSubTopic updates the active subtopic on the sidebar based on the
  // hash
  // @params hash [String] - hash including the hash sign at the beginning
  function setActiveSubTopic(hash) {
    // Set inactive the previously active topic
    var prevActiveTopic = document.querySelector('.sub-topics .topic.active');
    var nextActiveTopic = document.querySelector('.sub-topics a[href="' + hash + '"]').parentNode;

    if (prevActiveTopic !== nextActiveTopic) {
      nextActiveTopic.classList.add('active');

      if (prevActiveTopic) {
        prevActiveTopic.classList.remove('active');
      }
    }
  }

  // updateSidebar updates the active menu in the sidebar
  function updateSidebar() {
    var currentScrollY = document.body.scrollTop;

    var activeHash;
    for (var i = 0; i < allLinks.length; i++) {
      var h = allLinks[i];
      var hash = h.getElementsByTagName('a')[0].hash;

      if (h.offsetTop - 250 > currentScrollY) {
        if (!activeHash) {
          activeHash = hash;
          break;
        }
      } else {
        activeHash = hash;
      }
    }

    if (activeHash) {
      setActiveSubTopic(activeHash);
    }
  }

  if (h2sWithH3s.length > 0) {
    createSubtopic(activeLink, h2sWithH3s);
  }

  var subTopics = document.querySelectorAll('.sub-topics .sub-topic')
  for (var i = 0; i < subTopics.length; i++) {
    var subTopic = subTopics[i]
    subTopic.addEventListener('click', function (e) {
      var hash = e.target.hash;
      setActiveSubTopic(hash);
    });
  }

  // Scrollspy for sidebar
  window.addEventListener('scroll', debounce(updateSidebar, 15));

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
      showMore.innerHTML = "<span>Show all</span>";
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

  // syncWithOriginalRunnable syncs the code change in the runnable modal with
  // the original runnable
  // @params modalRunnableEl - HTML element for modal runable
  // @params text - text to sync
  function syncWithOriginalRunnable(modalRunnableEl, text) {
    var checksum = $(modalRunnableEl).closest('.runnable').data('checksum');
    var $otherRunnable = $('.runnable[data-checksum="' + checksum + '"]')
                          .not('#runnable-modal .runnable');

    $otherRunnable.find('.query-editable').text(text);
  }

  // setupRunnableClipboard configures clipboard buttons for runnable
  // @params runnableEl {HTMLElement} - HTML Element for runnable
  function setupRunnableClipboard(runnableEl) {
    // Set up clipboard
    var codeClipEl = $(runnableEl).find('.code-btn[data-action="copy-code"]')[0];
    var codeClip = new Clipboard(codeClipEl, {
      text: function(trigger) {
        var $runnable = $(trigger).closest('.runnable');
        var text = $runnable.find('.runnable-code').text().trim();
        return text.replace(/^\$\s/gm, "");
      }
    });

    codeClip.on("success", function(e) {
      e.clearSelection();
      $(e.trigger).text("Copied")
        .addClass('copied');

      window.setTimeout(function() {
        $(e.trigger).text("Copy").removeClass('copied');
      }, 2000);
    });

    codeClip.on("error", function(e) {
      e.clearSelection();
      $(e.trigger).text("Error copying");

      window.setTimeout(function() {
        $(e.trigger).text("Copy");
      }, 2000);
    });

    var outputClipEl = $(runnableEl).find('.code-btn[data-action="copy-output"]')[0];
    var outputClip = new Clipboard(outputClipEl, {
      text: function(trigger) {
        var $runnable = $(trigger).closest('.runnable');
        var $output = $runnable.find('.output');

        var text = $output.text().trim() || ' ';
        return text;
      }
    });

    outputClip.on("success", function(e) {
      e.clearSelection();
      $(e.trigger).text("Copied")
        .addClass('copied');

      window.setTimeout(function() {
        $(e.trigger).text("Copy").removeClass('copied');
      }, 2000);
    });

    outputClip.on("error", function(e) {
      e.clearSelection();
      $(e.trigger).text("Error copying");

      window.setTimeout(function() {
        $(e.trigger).text("Copy");
      }, 2000);
    });
  }

  // launchRunnableModal launches a runnable in a modal and configures the
  // clipboard buttons
  // @params runnabelEl {HTMLElement} - a runnable element
  function launchRunnableModal(runnabelEl) {
    var $runnable = $(runnabelEl);
    var $modal = $('#runnable-modal');
    var $modalBody = $modal.find('.modal-body');

    // set inner html as runnable
    var str = $runnable.prop('outerHTML');
    $modalBody.html(str);

    // show modal
    $modal.modal({
      keyboard: true
    });

    var runnableEl = $modal.find('.runnable');
    setupRunnableClipboard(runnableEl);
  }


  $(document).on('input', '#runnable-modal .query-editable', function (e) {
    syncWithOriginalRunnable(this, e.target.innerText);
  });

  // Running code
  $(document).on('click', '.runnable [data-action="run"]', function (e) {
    e.preventDefault();

    // there can be at most two instances of a same runnable because users can
    // launch a runnable as a modal. they share the same checksum
    var checksum = $(this).closest('.runnable').data('checksum');
    var $currentRunnable = $(this).closest('.runnable');
    var $runnables = $('.runnable[data-checksum="' + checksum + '"]');
    var codeEl = $runnables.find('.output');
    var isModal = $currentRunnable.parents('#runnable-modal').length > 0;
    var query = $(this).closest('.runnable').find('.query-editable').text();

    $runnables.find('.output-container').removeClass('empty error');
    codeEl.text('Waiting for the server response...');

    $.post({
      url: 'https://play.dgraph.io/query',
      data: query,
      dataType: 'json'
    })
    .done(function (res) {
      var resText = JSON.stringify(res, null, 2);

      codeEl.text(resText);
      for (var i = 0; i < codeEl.length; i++) {
        hljs.highlightBlock(codeEl[i]);
      }

      if (!isModal) {
        var currentRunnableEl = $currentRunnable[0];
        launchRunnableModal(currentRunnableEl);
      }
    })
    .fail(function (xhr, status, error) {
      $runnables.find('.output-container').addClass('error');

      codeEl.text(xhr.responseText || error);
    });
  });

  // Refresh code
  $(document).on('click', '.runnable [data-action="reset"]', function (e) {
    e.preventDefault();

    var $runnable = $(this).closest('.runnable');
    var initialQuery = $runnable.data('initial');

    $runnable.find('.query-editable').text('');

    var isModal = $runnable.parents('#runnable-modal').length > 0;
    if (isModal) {
      syncWithOriginalRunnable($runnable[0], initialQuery);
    }

    window.setTimeout(function() {
      $runnable.find('.query-editable').text(initialQuery);
    }, 80);
  });

  $(document).on('click', '.runnable [data-action="expand"]', function (e) {
    e.preventDefault();

    var $runnable = $(this).closest('.runnable');
    var runnableEl = $runnable[0];
    launchRunnableModal(runnableEl)
  });

  // Focus editable parts when code is clicked
  $(document).on('click', '.runnable-code', function () {
    $(this).find('.query-editable').focus();
  });

  // Runnable modal event hooks
  $('#runnable-modal').on('hidden.bs.modal', function (e) {
    $(this).find('.modal-body').html('');
  });

  // On page load
  updateSidebar();
  document.querySelector('.sub-topics .topic.active').scrollIntoView();

  $('.runnable').each(function () {
    setupRunnableClipboard(this);
  });

  /********** Config **/

  // Get clipboard.js to work inside bootstrap modal
  // http://stackoverflow.com/questions/38398070/bootstrap-modal-does-not-work-with-clipboard-js-on-firefox
  $.fn.modal.Constructor.prototype._enforceFocus = function() {};
})();
