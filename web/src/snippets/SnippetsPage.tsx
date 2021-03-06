import H from 'history'
import { uniqueId } from 'lodash'
import React, { createRef, useEffect, useLayoutEffect, useState } from 'react'
import { from } from 'rxjs'
import { filter, map } from 'rxjs/operators'
import { EditorId } from '../../../shared/src/api/client/services/editorService'
import { TextModel } from '../../../shared/src/api/client/services/modelService'
import { PanelViewWithComponent } from '../../../shared/src/api/client/services/view'
import { SNIPPET_URI_SCHEME } from '../../../shared/src/api/client/types/textDocument'
import { ContributableViewContainer } from '../../../shared/src/api/protocol'
import { EditorCompletionWidget } from '../../../shared/src/components/completion/EditorCompletionWidget'
import { EditorTextField } from '../../../shared/src/components/editorTextField/EditorTextField'
import { WithLinkPreviews } from '../../../shared/src/components/linkPreviews/WithLinkPreviews'
import { Markdown } from '../../../shared/src/components/Markdown'
import { ExtensionsControllerProps } from '../../../shared/src/extensions/controller'
import { createLinkClickHandler } from '../../../shared/src/util/linkClickHandler'
import { renderMarkdown } from '../../../shared/src/util/markdown'
import { isDefined } from '../../../shared/src/util/types'
import { COMPLETION_WIDGET_CLASS_PROPS } from '../components/completion/styles'
import { LINK_PREVIEW_CLASS } from '../components/linkPreviews/styles'
import { setElementTooltip } from '../components/tooltip/Tooltip'

interface Props extends ExtensionsControllerProps {
    location: H.Location
    history: H.History
}

/**
 * Shows a text field for a snippet. This functionality is currently incomplete and is intended only
 * to allow experimentation with extensions that listen for changes in documents and display
 * Markdown-formatted text.
 */
export const SnippetsPage: React.FunctionComponent<Props> = props => {
    const [textArea, setTextArea] = useState<HTMLTextAreaElement | null>(null)
    const textAreaRef = createRef<HTMLTextAreaElement>()
    useLayoutEffect(() => setTextArea(textAreaRef.current))

    const [editorId, setEditorId] = useState<EditorId | null>(null)
    const [modelUri, setModelUri] = useState<string | null>(null)

    const urlQuery = new URLSearchParams(props.location.search)

    const textAreaClassName = urlQuery.has('mono') ? 'text-monospace' : ''

    const initialModelUriScheme = urlQuery.get('scheme') || SNIPPET_URI_SCHEME
    const initialModelLanguageId = urlQuery.get('languageId') || 'plaintext'
    const initialModelText = urlQuery.get('text') || ''
    useEffect(() => {
        const model: TextModel = {
            uri: uniqueId(`${initialModelUriScheme}://`),
            languageId: initialModelLanguageId,
            text: initialModelText,
        }
        props.extensionsController.services.model.addModel(model)
        setModelUri(model.uri)
        const editor = props.extensionsController.services.editor.addEditor({
            type: 'CodeEditor',
            resource: model.uri,
            selections: [],
            isActive: true,
        })
        setEditorId(editor)
        return () => {
            props.extensionsController.services.editor.removeEditor(editor)
            props.extensionsController.services.model.removeModel(model.uri)
        }
    }, [initialModelUriScheme, initialModelLanguageId, initialModelText])

    const [panelViews, setPanelViews] = useState<PanelViewWithComponent[] | null>(null)
    useEffect(() => {
        const subscription = props.extensionsController.services.views
            .getViews(ContributableViewContainer.Panel)
            .subscribe(views => setPanelViews(views))
        return () => subscription.unsubscribe()
    }, [])

    // Add Markdown panel for Markdown snippets.
    const [modelText, setModelText] = useState<string | null>(null)
    useEffect(() => {
        if (!editorId) {
            return () => void 0
        }
        const subscription = from(props.extensionsController.services.editor.editors)
            .pipe(
                map(editors => editors.find(e => e.editorId === editorId.editorId)),
                filter(isDefined),
                map(editor => editor.model.text)
            )
            .subscribe(text => setModelText(text || null))
        return () => subscription.unsubscribe()
    }, [editorId, initialModelLanguageId])
    const allPanelViews: PanelViewWithComponent[] | null =
        initialModelLanguageId === 'markdown' && modelText !== null
            ? [...(panelViews || []), { title: 'Preview', content: modelText, priority: 0 }]
            : panelViews

    return (
        <div className="container mt-3">
            <h1>
                Snippet editor <span className="badge badge-warning">Experimental</span>
            </h1>
            {editorId && modelUri && (
                <>
                    {textArea && (
                        <EditorCompletionWidget
                            textArea={textArea}
                            editorId={editorId.editorId}
                            extensionsController={props.extensionsController}
                            {...COMPLETION_WIDGET_CLASS_PROPS}
                        />
                    )}
                    <EditorTextField
                        className={`form-control ${textAreaClassName || ''}`}
                        placeholder="Type a snippet"
                        editorId={editorId.editorId}
                        modelUri={modelUri}
                        autoFocus={true}
                        spellCheck={false}
                        rows={12}
                        textAreaRef={textAreaRef}
                        extensionsController={props.extensionsController}
                    />
                </>
            )}
            {allPanelViews &&
                allPanelViews.length > 0 &&
                allPanelViews.map((view, i) => (
                    <div key={i} className="mt-3 card">
                        <h3 className="card-header">{view.title}</h3>
                        <div className="card-body" onClick={createLinkClickHandler(props.history)}>
                            <WithLinkPreviews
                                dangerousInnerHTML={renderMarkdown(view.content)}
                                extensionsController={props.extensionsController}
                                setElementTooltip={setElementTooltip}
                                linkPreviewContentClass={LINK_PREVIEW_CLASS}
                            >
                                {props => <Markdown {...props} />}
                            </WithLinkPreviews>
                        </div>
                    </div>
                ))}
        </div>
    )
}
