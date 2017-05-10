$(document).on('click', '.toggleCommentsAnchor', function(event) {
    event.preventDefault();
    $(this).closest('.youtrack-issues__issue-info').toggleClass('active');
});

var stringToColor = function(str) {
    var color_codes = {};
    var a = str.charCodeAt(0);
    return (str in color_codes) ? color_codes[str] : (color_codes[str] = '#'+ ('000000' + (a*(a/4625)*0xFFFFFF<<0).toString(16)).slice(-6));
}

function padZero(str, len) {
    len = len || 2;
    var zeros = new Array(len).join('0');
    return (zeros + str).slice(-len);
}

function invertColor(hex, bw) {
    if (hex.indexOf('#') === 0) {
        hex = hex.slice(1);
    }
    // convert 3-digit hex to 6-digits.
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length !== 6) {
        throw new Error('Invalid HEX color.');
    }
    var r = parseInt(hex.slice(0, 2), 16),
    g = parseInt(hex.slice(2, 4), 16),
    b = parseInt(hex.slice(4, 6), 16);
    if (bw) {
        // http://stackoverflow.com/a/3943023/112731
        return (r * 0.299 + g * 0.587 + b * 0.114) > 186
        ? '#000000'
        : '#FFFFFF';
    }
    // invert color components
    r = (255 - r).toString(16);
    g = (255 - g).toString(16);
    b = (255 - b).toString(16);
    // pad each with zeros and return
    return "#" + padZero(r) + padZero(g) + padZero(b);
}

function printDate(timestamp, colorize) {
    var momentTimestamp = moment.unix(timestamp/1000);

    // if date is older than 1 day - show exact time
    var curTimestamp = new Date().getTime();
    var daysPast = (curTimestamp - timestamp)/1000/60/60/24;

    var result = momentTimestamp.fromNow();

    //replace long strings
    var replacementObj = {
        'a few seconds': 'just now',
        ' seconds': 's',
        ' minutes': 'min',
        ' hours': 'h',
        ' days': 'd',
        'a day ago': 'yesterday',
        ' weeks': 'w'
    };

    for (var val in replacementObj)
        result = result.replace(new RegExp(val, "g"), replacementObj[val]);

    if(daysPast > 0.9)
        result += ' at ' + momentTimestamp.format('HH:mm');

    if(colorize) {
        var maxDays = 14;// 2 weeks

        var opacity = (maxDays - daysPast) / maxDays;
        if(opacity < 0.2)
            opacity = 0.2;
        result = '<span style="color: #ff0000; opacity: ' + opacity.toFixed(1) + ';">' + result + '</span>'
    }

    return result;
}

function printName(str) {
    var initials = str.replace(/\W*(\w)\w*/g, '$1').toUpperCase();
    var initialsLength = initials.length;
    var halfIndex = Math.floor(initialsLength/2);
    var firstStr = initials.substr(0, halfIndex);
    var firstStrColor = stringToColor(firstStr);

    var secondStr = initials.substr(halfIndex);
    var secondStrColor = stringToColor(secondStr);

    var textColor = invertColor(firstStrColor, true);
    var shadowClass = textColor == '#000000' ? 'white_shadow' : '';

    return '<span class="helper_avatar ' + shadowClass + '" title="' + str + '" style="background: linear-gradient(135deg, ' + firstStrColor + ' 0%, ' + secondStrColor + ' 100%); color: ' + textColor + ';">' + initials + '</span>';
}

function modifyDashboard($parent) {
    //if $parent not set - update all widgets
    $parent = $parent || $(document);
    $parent.find('.youtrack-issues__issue-id').each(function(index, el) {
        var issueId = this.text;
        $.ajax({
            url: '/youtrack/rest/issue/'+issueId,
            type: 'GET',
            dataType: 'json',
            context: this
        })
        .done(function(response) {
            //get needed info
            var updatedAt = updaterName = lastCommentsText = '';
            var stateField = {};
            $.each(response.field, function(i, issueField) {
                if(issueField.name == 'updated')
                    updatedAt = issueField.value;
                if(issueField.name == 'updaterFullName')
                    updaterName = issueField.value;
                if(issueField.name == 'State')
                    stateField = issueField;

                //stop if we've found all we need
                if(updatedAt && updaterName && Object.keys(stateField).length > 0)
                    return false;
            });

            var $issueContainer = $(this).closest('.youtrack-issues__issue .youtrack-issues__issue-info');

            //show last updated date
            var $updatedContainer = $issueContainer.find('.last_updated');
            if(!$updatedContainer.length) {
                $issueContainer.prepend('<span class="last_updated"></span>');
                $updatedContainer = $issueContainer.find('.last_updated');
            }

            $updatedContainer.html(printDate(updatedAt, true) + printName(updaterName));

            //show state
            var $stateBlock = $issueContainer.find('.helper_state');
            if(!$stateBlock.length) {
                var $stateBlock = $("<span>").attr({
                    'class': "helper_state",
                    'style': 'color: ' + stateField.color.fg + '; background-color: ' + stateField.color.bg + '',
                    'title': stateField.value[0]
                })
                .text(stateField.value[0].substr(0,1))
                .insertBefore($issueContainer.find('.helper_avatar '));
            }
            else {
                $stateBlock.text(stateField.value[0].substr(0,1));
            }

            //get last 2 comments
            if(response.comment.length) {
                var $commentsContainer = $issueContainer.next('.helper_comments');
                if(!$commentsContainer.length) {
                    $issueContainer.after('<div class="helper_comments"></div>');
                    $commentsContainer = $issueContainer.next('.helper_comments');
                }

                lastCommentsText = '';
                var lastComments = response.comment.slice(-2);
                $.each(lastComments, function(index, comment) {
                    lastCommentsText += '<div class="helper_comment"><div class="helper_comment_info"><span class="helper_comment_author">' + comment.authorFullName + '</span> ' + printDate(comment.created) + '</div><div class="helper_comment_text">' + comment.text + '</div></div>';
                });

                //show last comments
                $commentsContainer.html(lastCommentsText);

                //show comment toggler
                var $commentsToggler = $issueContainer.find('.toggleCommentsAnchor');
                if(!$commentsToggler.length) {
                    $issueContainer.append('<div title="Show comments" class="toggleCommentsAnchor "><span class="comments-toggler-ico font-icon icon-comment "></span> <span class="helper_comments_total"></span></div>');
                    $commentsToggler = $issueContainer.find('.toggleCommentsAnchor');
                }
                $commentsToggler.find('.helper_comments_total').html(response.comment.length);
            }
        });
    });
}

function refreshButtonCreator () {
   setTimeout(function () {
      if ($('.dashboard-page__toolbar-buttons').length < 1) {
         refreshButtonCreator();
      }
      else {
        $('.dashboard-page__toolbar-buttons').prepend('<button class="ring-button ring-btn_blue helper_main_refresh_button"><span class="ring-button__content"><span>Refresh</span></span></button>');
      }
   }, 2000)
}

$(function() {
    refreshButtonCreator();
});

$(document).on('click', '.helper_main_refresh_button', function(event){
    event.preventDefault();
    modifyDashboard();
});

$(document).on('click', 'widget .widget__icon.ring-icon', function(event){
    event.preventDefault();
    var $parent = $(this).closest('widget');
    setTimeout(function(){
        modifyDashboard($parent);
    }, 2000);
});



