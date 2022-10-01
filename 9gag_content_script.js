/**
 * @typedef {Object} ImageData
 * @property {string} postId id of the 9gag post
 * @property {string} firstSeen when was this post first seen
 */

const IMAGE_STORE_NAME = "no-reposts-image-data";
if (location.href.indexOf('/gag/') == -1) (function () {
	const hideYoutubes = true;
	const tags = JSON.parse(localStorage['no-reposts-tags'] || '{}')
	let keepWorking = true;
	let indexedDb;

	 // initialize indexedDb
	const openRequest = window.indexedDB.open(IMAGE_STORE_NAME, 1);
	openRequest.onupgradeneeded = event => {
		const objectStore = event.target.result.createObjectStore(IMAGE_STORE_NAME, {keyPath: "postId"});
		objectStore.createIndex("firstSeen", "firstSeen");
		console.log('indexedDb created');
	};
	openRequest.onerror = (event) => {
		console.log('error opening indexedDb', event);
	};
	openRequest.onsuccess = (event) => {
		console.log('indexedDb initialised', event);
		// store the result of opening the database in the db variable. This is used a lot below
		indexedDb = openRequest.result;
	};
	(function insertStopButton() {
		const button = document.createElement("button");
		button.textContent = 'filtering'
		button.addEventListener('click', () => {
			keepWorking = !keepWorking;
			button.style.color = keepWorking ? "lime" : "red";
			button.style.textDecoration = keepWorking ? "" : "line-through";
		})
		button.style.position = 'fixed';
		button.style.zIndex = '10000';
		button.style.color = 'lime';
		document.body.insertBefore(button, document.body.firstChild);
	})();

	function tagActionListener(event) {
		event.preventDefault();
		tags[event.target.getAttribute('data-no-reposts-tag')] = event.target.getAttribute('data-no-reposts-action');
		localStorage['no-reposts-tags'] = JSON.stringify(tags);
		event.target.removeEventListener('click', tagActionListener);
		event.target.addEventListener('click', forgetTagListener, false);
		event.target.textContent = 'forget';
		return false;
	}
	function forgetTagListener(event) {
		event.preventDefault();
		delete tags[event.target.getAttribute('data-no-reposts-tag')];
		localStorage['no-reposts-tags'] = JSON.stringify(tags);
		event.target.removeEventListener('click', forgetTagListener);
		event.target.addEventListener('click', tagActionListener, false);
		event.target.textContent = event.target.getAttribute('data-no-reposts-action');
		return false;
	}
	setTimeout(() => {
		nodes(document, '#list-view-2')
			.forEach(list => {
				new MutationObserver(mutations => {
					mutations.forEach(function(mutation) {
						checkForReposts(mutation.target);
					});
				}).observe(list, {
					childList: true,
					attributes: false,
					characterData: false,
					subtree: false,
					attributeOldValue: false,
					characterDataOldValue: false
				});
				list.addEventListener("click", event => {
					if (event.target.tagName == 'SPAN' && event.target.className == 'toggleLink') {
						let entry = null;
						for (let current = event.target; current.parentNode; current = current.parentNode) {
							let dataString = current.getAttribute('data-my-post-data');
							if (dataString) {
								entry = current;
								break;
							}
						}
						// const entryId = (event.target.getAttribute('data-entryid') || '').replace(/jsid-post-/, ''); //event.target.getAttribute('jsid-post-a2o4zoD');
						// if (entryId === null || entryId == 'null') return;
						if (entry) {
							event.preventDefault();
							console.log('open clicked');// ' + entryId);
							// const entry = document.getElementById('jsid-post-' + entryId);
							const open = entry.className.match(/\bopen\b/);
							entry.className = entry.className.replace(/ *open */g, ' ') + (open ? '' : ' open');
							return false;
						}
					}
				}, false);
			})
			.forEach(checkForReposts);

		nodes(document, '#individual-post article.badge-entry-entity')
			.forEach(entry => checkEntry(entry));
	}, 1);

	setInterval(() => checkForReposts(document.getElementById('list-view-2')), 1000);

	function checkForReposts(list) {
		if (!keepWorking) {
			return;
		}
		nodes(list, "article:not([data-my-post-data])")
			// .filter(entry => !entry.getAttribute('data-my-post-data'))
			.forEach(entry => checkEntry(entry));
	}

	function checkEntry(entry) {
		entry.setAttribute('data-my-post-data', 'fetching');
		const postId = (entry.getAttribute('id') || 'jsid-post-').substring('jsid-post-'.length); //entry.getAttribute('data-entry-id');
		if (nodes(entry, '.youtube-post').count()) {
			if (hideYoutubes) {
				indicateYoutube(entry);
			}
			return;
		}
		if (!postId) {
			entry.style.display = 'none';
			entry.setAttribute('data-my-post-data', 'wtf');
			return;
		}
		const title = entry.querySelector('h1');
		if (title.textContent.match(/starter\s*pack/i)) {
			indicateStupidTitle(entry);
			return;
		}
		const tagElements = entry.querySelectorAll('.post-tag a');
		if (tagElements) {
			tagElements.forEach(tag => {
				const actionsEl = document.createElement('div');
				actionsEl.className = 'no-repost-actions';
				['show', 'ignore', 'hide'].forEach(action => {
					const link = document.createElement('span');
					link.target = '#';
					const tagName = tag.textContent.toLowerCase();
					link.setAttribute('data-no-reposts-tag', tagName);
					link.setAttribute('data-no-reposts-action', action);
					const currentState = tags[tagName];
					if (currentState != action) {
						link.textContent = action;
						link.addEventListener('click', tagActionListener, false);
					} else {
						link.textContent = 'forget';
						link.addEventListener('click', forgetTagListener, false);
					}
					actionsEl.appendChild(link);
				});
				tag.insertAdjacentElement('afterend', actionsEl);
			});
			const tagNames = Array.prototype.map.call(tagElements, el => el.textContent.toLowerCase());
			const alwaysVisibleTags = tagNames.filter(name => tags[name] == 'show');
			const tagsToHide = tagNames.filter(name => tags[name] == 'hide');
			const notIgnoredTagsCount = tagNames.filter(name => tags[name] != 'ignore').length;
			const showPost = alwaysVisibleTags.length > 0 || tagsToHide.length  === 0 && notIgnoredTagsCount > 0;
			if (!showPost) {
				indicateSectionHidden(entry, tagNames.join(', '));
				return;
			}
		}

		if (document.querySelectorAll("*[id='" +  entry.getAttribute("id") + "']").length > 1) {
			console.log("article#: " + entry.getAttribute("id") + " found multiple times, assuming duplicate");
			indicateAlreadySeen(entry);
			return;
		}

		function getOrStoreLocalData(retries = 30) {
			if (!indexedDb) {
				if (retries > 0) {
					setTimeout(() => getOrStoreLocalData(retries - 1), 100);
				}
				return;
			}
			const store = indexedDb.transaction(IMAGE_STORE_NAME).objectStore(IMAGE_STORE_NAME);
			const fetchRequest = store.getKey('postId');
			fetchRequest.onsuccess = event => {
				if (event.result) {
					applyDataToEntry(event.result, entry);
				} else {
					const newImageData = { postId, firstSeen: new Date().toString() };
					indexedDb.transaction(IMAGE_STORE_NAME, 'readwrite').objectStore(IMAGE_STORE_NAME).add(newImageData);
					applyDataToEntry(newImageData, entry);
				}
			}
		}

		entry.setAttribute('data-my-post-data', 'fetching');
		getOrStoreLocalData();
	}
	/**
	 * @param {ImageData} imageData
	 * @param {Element} entry
	 */
	function applyDataToEntry(imageData, entry) {
		entry.setAttribute('data-my-post-data', JSON.stringify(imageData));
		const postIsOld = Date.now() - new Date(imageData.firstSeen).getTime() > 2 * 3600 * 1000;
		if (postIsOld) {
			indicateOldPost(entry, imageData);
		} else {
			indicateGoodPost(entry);
		}

		function addDate(delay) {
			const meta = nodes(entry, '.post-meta');
			if (meta.count()) {
				meta.forEach(node => {
					node.appendChild(document.createTextNode(' · '));
					const dateDiv = document.createElement('span');
					dateDiv.appendChild(document.createTextNode('first seen: ' + moment(new Date(imageData.firstSeen)).format('YYYY-MM-DD HH:mm')));
					if (postIsOld) {
						dateDiv.className = 'error-message';
					}
					node.appendChild(dateDiv);
				})
			} else {
				// I don't know why, but it cat take > 1 minute for the element to be accessible
				setTimeout(() => {
					addDate(Math.min(1000, 2 * delay + 100));
				}, delay);
			}
		}
		addDate(0);
	}

	function indicateGoodPost(entry) {
		entry.className += ' good-post';
	}

	function indicateAlreadySeen(entry) {
		entry.className += ' old-post';
		entry.setAttribute('data-my-post-data', 'fuck you 9gag');
		makeToggle(entry, 'post was already shown');
	}
	function indicateSectionHidden(entry, section) {
		entry.className += ' old-post';
		entry.setAttribute('data-my-post-data', 'death by tags');
		makeToggle(entry, `post in section ${section}`);
	}
	function indicateStupidTitle(entry) {
		entry.className += ' old-post';
		entry.setAttribute('data-my-post-data', 'stupid title');
		makeToggle(entry, `stupid title`);
	}
	function indicateYoutube(entry) {
		entry.className += ' youtube-post';
		entry.setAttribute('data-my-post-data', 'youtube post');
		makeToggle(entry, 'youtube post');
	}
	function indicateOldPost(entry, imageData) {
		entry.className += ' old-post';
		makeToggle(entry, 'post from ' + moment(imageData.firstSeen).format('YYYY-MM-DD HH:mm'));
	}
	function makeToggle(entry, text, delay = 0) {
		setTimeout(() => {
			if (entry.firstChild) {
				entry.className += ' toggle-post';
				const toggleDiv = document.createElement('div');
				toggleDiv.className = 'toggle-post-header';
				entry.insertBefore(toggleDiv, entry.firstChild);
				const toggleLink = document.createElement('span');
				toggleLink.className = 'toggleLink';
				toggleDiv.appendChild(toggleLink);
				toggleLink.appendChild(document.createTextNode(text));
				toggleLink.setAttribute("data-entryId", entry.getAttribute("id"));
			} else {
				console.log("waiting until empty entry has childs before toggeling toggle");
				makeToggle(entry, text, Math.min(1000, 2 * delay + 100));
			}
		}, delay);
	}
	// UTILS
	function nodes(root, selector) {
		function actions(elements) {
			const myActions = {
				forEach(callback) {
					Array.prototype.forEach.call(elements, callback);
					return myActions;
				},
				count(callback) {
					if (typeof callback == 'function') {
						callback(elements.length);
						return myActions;
					}
					return elements.length;
				}
			};
			return myActions;
		}
		return actions(root.querySelectorAll(selector));
	}

})();
